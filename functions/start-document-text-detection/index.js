const { initializePowertools } = process.env.LAMBDA_TASK_ROOT ?
  require('/opt/nodejs/lambda-powertools') :
  require('../../layers/lambda-powertools/lambda-powertools');

const { TextractClient, StartDocumentTextDetectionCommand } = require('@aws-sdk/client-textract');
const textractClient = new TextractClient();

exports.handler = initializePowertools(async (event) => {
  const bucketName = event.detail.bucket.name;
  const objectKey = event.detail.object.key;

  const command = new StartDocumentTextDetectionCommand({
    DocumentLocation: {
      S3Object: {
        Bucket: bucketName,
        Name: objectKey
      }
    },
    NotificationChannel: {
      SNSTopicArn: process.env.DOCUMENT_TEXT_DETECTION_COMPLETED_SNS_TOPIC,
      RoleArn: process.env.DOCUMENT_TEXT_DETECTION_COMPLETED_SNS_TOPIC_ROLE
    }
  });

  const response = await textractClient.send(command);

  console.log('JobId', response.JobId);
  return response.JobId;
});