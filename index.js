const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");
const mailgun = require("mailgun-js");

// Replace with your Mailgun API key and domain
const mailgunApiKey = "YOUR_MAILGUN_API_KEY";
const mailgunDomain = "YOUR_MAILGUN_DOMAIN";

// Create an SNS topic
const topic = new aws.sns.Topic("my-topic");

// Create a DynamoDB table to track email delivery
const table = new aws.dynamodb.Table("emailDelivery", {
  attributes: [
    { name: "submissionId", type: "S" },
    { name: "timestamp", type: "N" },
  ],
  hashKey: "submissionId",
  billingMode: "PAY_PER_REQUEST",
});

// Create a Lambda function
const lambdaFunction = new aws.lambda.CallbackFunction("my-lambda", {
  callback: async (event, context) => {
    const submissionId = event.Records[0].Sns.MessageId;
    const status = await processSubmission(submissionId);

    // Send email using Mailgun
    const emailStatus = sendEmail(submissionId, status);

    // Store email delivery status in DynamoDB
    await recordEmailDelivery(submissionId, emailStatus);
  },
  policies: [
    // Attach policies as needed
    aws.iam.AWSLambdaBasicExecutionRole,
    // ... other policies
  ],
});

// Grant permission for SNS to invoke Lambda
const permission = new aws.lambda.Permission("allow-sns-invoke", {
  action: "lambda:InvokeFunction",
  function: lambdaFunction,
  principal: "sns.amazonaws.com",
  sourceArn: topic.arn,
});

// Function to process the submission and download from GitHub to GCS bucket
async function processSubmission(submissionId) {
  try {
    // Replace these with the actual GitHub repository details and GCS bucket settings
    const githubRepo = "owner/repository";
    const githubAccessToken = "YOUR_GITHUB_ACCESS_TOKEN";
    const gcsBucketName = "your-gcs-bucket-name";

    // Logic to download from GitHub (using octokit or other GitHub API library)
    const downloadLink = await downloadFromGitHub(
      githubRepo,
      githubAccessToken
    );

    // Logic to store in GCS bucket (using @google-cloud/storage or GCS SDK)
    await storeInGCSBucket(downloadLink, gcsBucketName);

    return "success"; // Return status (success)
  } catch (error) {
    console.error("Error during submission processing:", error);
    return "failure"; // Return status (failure)
  }
}

// Function to send email using Mailgun
function sendEmail(submissionId, status) {
  // Create a Mailgun instance
  const mg = mailgun({
    apiKey: mailgunApiKey,
    domain: mailgunDomain,
  });

  // Email details
  const emailData = {
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Submission Status",
    text: `Submission ID: ${submissionId}\nStatus: ${status}`,
  };

  // Sending the email via Mailgun
  mg.messages().send(emailData, (error, body) => {
    if (error) {
      console.error("Error:", error);
      return "error";
    } else {
      console.log("Email sent:", body);
      return "sent";
    }
  });
}

// Function to record email delivery in DynamoDB
async function recordEmailDelivery(submissionId, emailStatus) {
  const currentTime = Math.floor(Date.now() / 1000); // Get current timestamp in seconds

  const item = {
    SubmissionId: submissionId,
    EmailStatus: emailStatus,
    // Timestamp: currentTime.toString(),
  };

  // Create an instance of the DynamoDB Document Client
  const dynamoDB = new aws.sdk.DynamoDB.DocumentClient();

  try {
    // Use the promise-based version of the put method
    const result = await dynamoDB
      .put({
        TableName: table.name, // Use the correct table reference here
        Item: item,
      })
      .promise();

    console.log("Email delivery recorded successfully:", result);
  } catch (error) {
    console.error("Error recording email delivery:", error);
  }
}

// Export the SNS topic ARN
exports.topicArn = topic.arn;
