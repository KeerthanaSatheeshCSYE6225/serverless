"use strict";

const { Storage } = require("@google-cloud/storage");
const axios = require("axios");
const { Buffer } = require("buffer");
const AWS = require("aws-sdk");
const mailgun = require("mailgun-js");
const AdmZip = require("adm-zip");

const dynamoDb = new AWS.DynamoDB.DocumentClient();

const decodedKey = Buffer.from(process.env.serviceKey, "base64").toString(
  "utf-8"
);
const serviceAccountKey = JSON.parse(decodedKey);

const storage = new Storage({
  credentials: {
    project_id: process.env.PROJECT_ID,
    client_email: "keerthanasatheesh21@gmail.com",
    private_key: serviceAccountKey.private_key,
  },
});

AWS.config.update({
  accessKeyId: process.env.accessKeyId,
  secretAccessKey: process.env.secretAccessKey,
  region: us - east - 1,
});

module.exports.handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const mg = mailgun({
    apiKey: process.env.MAILGUN_API_KEY, // Add your Mailgun API key here
    domain: process.env.MAILGUN_DOMAIN, // Add your Mailgun domain here
  });

  try {
    const message = event.Records[0].Sns.Message;
    const [entriescount, allowed_attempts, deadline, email, url] =
      message.split(",");
    console.log("Message:", message);
    console.log("Attempt Number", entriescount);
    console.log("Allowed attempts", allowed_attempts);
    console.log("Deadline", deadline);
    console.log("email", email);
    console.log("url", url);

    const fileName = `${email}${Date.now()}.zip`;
    const bucketName = process.env.gcpBucketName;
    const bucket = storage.bucket(bucketName);

    const response = await axios.get(url, { responseType: "arraybuffer" });
    const fileContent = Buffer.from(response.data);

    const zip = new AdmZip(response.data);
    const entries = zip.getEntries();

    if (entries && entries.length > 0) {
      console.log("ZIP file has contents:");
      entries.forEach((entry) => {
        console.log(entry.entryName);
      });
    } else {
      console.log("ZIP file is empty.");
    }

    const file = bucket.file(fileName);
    await storage.bucket(bucketName).file(fileName).save(fileContent);
    console.log(
      `File from URL saved in Google Cloud Storage: gs://${bucketName}/${fileName}`
    );

    const emailParams = {
      Destination: {
        ToAddresses: [email],
      },
      Message: {
        Body: {
          Text: {
            Data: `
            Your provided URL is valid and processed. Your work is stored, counting as an attempt. Consider resubmitting within the deadline; otherwise, the latest submission will be considered. No further submissions are allowed if the deadline/attempts are exceeded.
            `,
          },
        },
        Subject: {
          Data: "Submission accepted",
        },
      },
      Source: process.env.sourceEmail,
    };

    const timestamp = new Date().toISOString();
    const dynamoParams = {
      TableName: process.env.DYNAMO_TABLE_NAME,
      Item: {
        EmailId: email,
        Timestamp: timestamp,
        Status: "Success",
      },
    };

    await dynamoDb.put(dynamoParams).promise();
    console.log("Item added to DynamoDB successfully");

    // Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Function executed successfully!",
        input: event,
      }),
    };
  } catch (error) {
    console.error("Error:", error);

    // Send failure email
    const data = {
      from: "keerthanasatheesh210@gmail.com",
      to: [email],
      subject: "Submission Rejected",
      text: `
      We regret to inform you that the provided URL is invalid and cannot be processed. Please review the link for accuracy. If time permits, attempt submission again; otherwise, the latest submission will be considered. You cannot submit if the deadline/attempts are exceeded. 
      `,
    };

    mg.messages().send(data, (error, body) => {
      if (error) {
        console.error("Error sending email:", error);
      } else {
        console.log("Email sent successfully:", body);
      }
    });

    const timestamp = new Date().toISOString();
    const dynamoParams = {
      TableName: process.env.DYNAMO_TABLE_NAME,
      Item: {
        EmailId: email,
        Timestamp: timestamp,
        Status: "Failed",
      },
    };

    await dynamoDb.put(dynamoParams).promise();
    console.log("Item added to DynamoDB successfully");

    // Return error response
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Function execution failed!",
        input: event,
      }),
    };
  }
};
