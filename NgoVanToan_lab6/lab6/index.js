require('dotenv').config(); 

const express = require('express');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const multer = require('multer');

const app = express();
app.set('view engine', 'ejs');
app.set('views', './views');
app.use(express.static('views'));
app.use(express.urlencoded({ extended: true }));

// 🔥 Cấu hình AWS SDK v3 với biến môi trường
const client = new DynamoDBClient({
    region: process.env.AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID, 
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
});

const docClient = DynamoDBDocumentClient.from(client);
const tableName = 'sanpham';
const upload = multer();

// Route lấy dữ liệu từ DynamoDB
app.get('/', async (req, res) => {
    try {
        const command = new ScanCommand({ TableName: tableName });
        const data = await docClient.send(command);
        res.render('index', { sanPhams: data.Items || [] });
    } catch (err) {
        console.error('Lỗi:', err);
        res.status(500).send('Internal Server Error');
    }
});

// Thêm dữ liệu vào DynamoDB
app.post("/", upload.none(), async (req, res) => { 
    console.log("Dữ liệu nhận được:", req.body);
    const { ma_sp, ten_sp, so_luong } = req.body;

    if (!ma_sp || !ten_sp || !so_luong) {
        return res.status(400).send("Thiếu dữ liệu sản phẩm!");
    }

    const params = {
        TableName: tableName,
        Item: {
            "ma_sp": ma_sp,
            "ten_sp": ten_sp,
            "so_luong": parseInt(so_luong, 10)
        }
    };

    try {
        await docClient.send(new PutCommand(params));
        console.log("Thêm dữ liệu thành công!");
        return res.redirect("/");
    } catch (err) {
        console.error("Lỗi khi thêm dữ liệu:", err);
        return res.status(500).send("Internal Server Error");
    }
});

// Xóa dữ liệu
app.post('/delete', upload.none(), async (req, res) => {
    let listItems = req.body.ma_sp;

    if (!listItems) {
        return res.redirect("/");
    }

    if (!Array.isArray(listItems)) {
        listItems = [listItems];
    }

    try {
        for (const id of listItems) {
            const params = {
                TableName: tableName,
                Key: { ma_sp: id }
            };

            await docClient.send(new DeleteCommand(params));
        }

        res.redirect("/");
    } catch (error) {
        console.error("Delete Error:", error);
        res.status(500).send('Internal Server Error');
    }
});

// Khởi động server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🔥 Server chạy tại: http://localhost:${PORT}`);
});
