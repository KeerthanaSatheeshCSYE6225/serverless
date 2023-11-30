# Serverless Application with Pulumi

This Pulumi program sets up a serverless application on AWS using AWS Lambda, SNS, DynamoDB, and Mailgun to process submissions, send emails, and store delivery status.

## Prerequisites

Before running this application, ensure you have:

- [Node.js](https://nodejs.org/) installed (v14.x or later)
- [Pulumi CLI](https://www.pulumi.com/docs/get-started/install/) installed
- AWS account credentials configured
- Mailgun API key and domain details
- GitHub repository details and access token
- Google Cloud Storage (GCS) bucket details

## Setup

1. Clone this repository or download the code to your local environment.

2. Install dependencies:

   ```bash
   npm install
