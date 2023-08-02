const { initializePowertools } = process.env.LAMBDA_TASK_ROOT ?
  require('/opt/nodejs/lambda-powertools-utils') :
  require('../../layers/lambda-powertools-utils/lambda-powertools-utils');

exports.handler = initializePowertools(async (event) => {
  return 'hello world';
});