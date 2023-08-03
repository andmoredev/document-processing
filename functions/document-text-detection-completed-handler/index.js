const { initializePowertools } = process.env.LAMBDA_TASK_ROOT ?
  require('/opt/nodejs/lambda-powertools') :
  require('../../layers/lambda-powertools/lambda-powertools');

const { TextractClient, GetDocumentTextDetectionCommand } = require('@aws-sdk/client-textract');
const textractClient = new TextractClient();

exports.handler = initializePowertools(async (event) => {
  const jobId = JSON.parse(event.Records[0].Sns.Message).JobId;
  const command = new GetDocumentTextDetectionCommand({
    JobId: jobId
  });

  const response = await textractClient.send(command);

  console.log(JSON.stringify(response));
  return 'hello world';
});