const express = require("express");
const app = express();
const post = 3000;
const path = require("path");
const AWS = require("aws-sdk");
const multer = require("multer"); // middleware for handling multipart/form-data
const { v4: uuid } = require("uuid"); // Import the uuid library for generating unique IDs


app.use(express.json({ extended: false }));
app.use(express.static(path.join(__dirname, "views")));
app.set("view engine", "ejs");
app.set("views", "./views");

app.use(express.urlencoded({ extended: true }));

require('dotenv').config(); // Load environment variables from .env file


process.env.AWS_SDK_JS_SUPRESS_MAINTENANCE_MODE_MASSAGE = "1";

AWS.config.update({
    region: 'ap-southeast-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
})
const docClient = new AWS.DynamoDB.DocumentClient(); // Create a DynamoDB DocumentClient instance

const s3 = new AWS.S3(); // Create an S3 instance


const bucketName = process.env.BUCKET_NAME; // S3 bucket name
//upload
const tableName = 'sanpham'; // DynamoDB table name

//cau hinh multer quan ly upload image
const storage = multer.memoryStorage({
  destination(req, file, callback) {
    callback(null, ""); // set destination để lưu trữ file trong bộ nhớ tạm thời
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limit file size to 5MB
  },
  fileFilter(req, file, callback) { // kiểm tra loại file
    checkFileType(file, callback);
  },
});

const CLOUD_FRONT_URL = 'https://d1mrfknlmvbwm.cloudfront.net'; // CloudFront URL for accessing S3 files

// kiểm tra loại file. 
function checkFileType(file, cb) {
  const fileTypes = /jpeg|jpg|png|gif/;
  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = fileTypes.test(file.mimetype);
  if (extname && mimetype) {
    return cb(null, true);
  }
  return cb("Error: Pls upload images /jpeg|jpg|png|gif/ only!");
}

app.get("/", (req, res) => {

  const params = {
    TableName: tableName,
  };

  docClient.scan(params, (err, data) => {
    if (err) {
      console.error("Error fetching data:", err);
      res.status(500).send("Internal Server Error");
    } else {
      res.render("index", { sanPhams: data.Items });
    }
  });
});

//them
app.post("/save", upload.single("hinh_anh"), async (req, res) => {
    try {
        const { ma_sp, ten_sp, so_luong } = req.body;

        const image = req.file.originalname.split('.'); // lay ten file
        const fileType = image[image.length - 1]; // lay phan mo rong
        const filePath = `${uuid()}_${new Date().getTime()}.${fileType}`; // ten file moi

        const paramsS3 = {
            Bucket: bucketName,
            Key: filePath,
            Body: req.file.buffer, // Buffer data from multer
            ContentType: req.file.mimetype // MIME type of the file
        };
s3.upload(paramsS3, (err, data) => {

            if(err) {
                console.error("Error uploading file to S3:", err);
                return res.status(500).send("Internal Server Error");
            } else {

                // params để lưu trữ dữ liệu vào DynamoDB
                const params = {
                    TableName: tableName,
                    Item: {
                        ma_sp: ma_sp,
                        ten_sp: ten_sp,
                        so_luong: so_luong,
                        hinh_anh: `${CLOUD_FRONT_URL}/${filePath}`, // URL của hình ảnh đã upload lên S3
    
                    },
                };
        
                // thêm imageUrl vào params.Item
        
                // lưu dữ liệu vào DynamoDB
                docClient.put(params, (err, data) => {
                    if (err) {
                        console.error("Error fetching data:", err);
                        res.status(500).send("Internal Server Error");
                    } else {
                        res.redirect("/");
                    }
                });
            }

        });

    } catch (err) {

        return res.status(500).send("Internal Server Error");
    }
  
});

//xóa
app.post("/delete", upload.fields([]), (req, res) => {
  const listItems = Object.keys(req.body); // lấy danh sách các key từ req.body

  console.log("listItems: ", listItems);
  if (listItems.length === 0) {
    console.log("Khong co san pham nao de xoa");
    return res.redirect("/");
  }

  // Gọi hàm đệ quy để xóa từng mục trong danh sách
  function onDeleteItems(index) {
    // du lieu can xoa
    // listItems[index] là Id của sản phẩm cần xóa
    const params = {
      TableName: tableName,
      Key: {
        ma_sp: listItems[index],
      },
    };

    //
    docClient.delete(params, (err, data) => {
      if (err) {
        console.error("Error fetching data:", err);
      } else {
        // Nếu còn phần tử nào trong danh sách, gọi đệ quy để xóa tiếp
        // Nếu không còn phần tử nào, quay về trang chủ
        if (index > 0) {
          onDeleteItems(index - 1);
        } else {
          console.log("Da xoa xong");

          return res.redirect("/");
        }
      }
    });
  }

  onDeleteItems(listItems.length - 1); // Bắt đầu từ phần tử cuối cùng trong danh sách
});

app.listen(post, () => {
  console.log(`Server is running on http://localhost:${post}`);
});