/*This is for specifing region that we have our DynamoDB created so Lambda and DynamoDB should be avail in us-east-1*/
const AWS = require('aws-sdk');
AWS.config.update( {
  region: 'us-east-1'
});

const dynamodb = new AWS.DynamoDB.DocumentClient(); /*for connecting to AWS DynamoDB*/
const dynamodbTableName = 'product-inventory';/*Table that we created in DynamoDB*/

/*Below three are the resources of API gateway that will have required action methods*/
/*Created in Amazon API gateway*/
const healthPath = '/health';
const productPath = '/product';
const productsPath = '/products';

/*Based on the event it will trigger the specific CRUD action method for specific API Gateway resource */
/*It is checking method and resource(path of resource in root of the API Gateway)*/
/*So basically just creating cases here to match with the methods we defined in the API gateway*/
exports.handler = async function(event) {
  console.log('Request event: ', event);
  let response;
  switch(true) {
    case event.httpMethod === 'GET' && event.path === healthPath:
      response = buildResponse(200); /*build response also a common function for returning response of all the functions*/
      break;
    case event.httpMethod === 'GET' && event.path === productPath:
      response = await getProduct(event.queryStringParameters.productId);
      break;
    case event.httpMethod === 'GET' && event.path === productsPath:
      response = await getProducts();
      break;
    case event.httpMethod === 'POST' && event.path === productPath:
      response = await saveProduct(JSON.parse(event.body)); /*Converting Json event body to JSON*/
      break;
    case event.httpMethod === 'PATCH' && event.path === productPath:
      const requestBody = JSON.parse(event.body);
      response = await modifyProduct(requestBody.productId, requestBody.updateKey, requestBody.updateValue);
      break;
    case event.httpMethod === 'DELETE' && event.path === productPath:
      response = await deleteProduct(JSON.parse(event.body).productId);
      break;
    default:
      response = buildResponse(404, '404 Not Found');
  }
  return response;
}

/*Below are the CRUD function definitions*/
/*dynamodb.get() method is help to get the data from the */
async function getProduct(productId) {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      'productId': productId
    }
  }
  /*passing two parameters and returning response for getting the product details based on primary key=productID*/
  /*And I have two returns here, because in modern javascript it introduced something called error function(the inside return function)*/
  /*And we return inside function response to the outside return function that will return to the calling function*/
  return await dynamodb.get(params).promise().then((response) => {
    return buildResponse(200, response.Item);
  }, (error) => {
    /*Based on situation handling the errors*/
    console.error('Do your custom error handling here. I am just gonna log it: ', error);
  });
}

/*Below function returns all the products that are available in DB by passing one tablename */
async function getProducts() {
  const params = {
    TableName: dynamodbTableName
  }
  /*It using sub method called scanDynamoRecords to fetch all the products*/
  const allProducts = await scanDynamoRecords(params, []);
  const body = {
    products: allProducts
  }
  return buildResponse(200, body);
}

/*dynamodb.scan() method is for scanning all the items and help to re-iterate*/
/*it is recursive function because in DynamoDB there's a limit on how much data we can return on one part */
/*so that one query would get one items and we are checking using value(LastEvaluatedKey)*/
async function scanDynamoRecords(scanParams, itemArray) {
  try {
    const dynamoData = await dynamodb.scan(scanParams).promise();
    /*Concatenating all the products one by one and incrementing the record value using LastEvaluatedKey and iterating till last item(product) */
    itemArray = itemArray.concat(dynamoData.Items);
    if (dynamoData.LastEvaluatedKey) {
      scanParams.ExclusiveStartkey = dynamoData.LastEvaluatedKey;
      return await scanDynamoRecords(scanParams, itemArray);
    }
    return itemArray;
  } catch(error) {
    console.error('Do your custom error handling here. I am just gonna log it: ', error);
  }
}

/*This is for POST method for savng the product*/
/*dynamodb.put() method is to insert the data*/
async function saveProduct(requestBody) {
  const params = {
    TableName: dynamodbTableName,
    Item: requestBody
  }
  /*whatever we are putting in body below will display in response of the API when we hit*/
  return await dynamodb.put(params).promise().then(() => {
    const body = {
      Operation: 'SAVE',
      Message: 'SUCCESS',
      Item: requestBody
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('Do your custom error handling here. I am just gonna log it: ', error);
  })
}

/*This function will modify the product record based on the unique record(key and value) but for that we need to pass the productID as well*/
/*dynamodb.update() will update the record using UpdateExpression and ExpressionAttributeValues */
async function modifyProduct(productId, updateKey, updateValue) {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      'productId': productId
    },
    UpdateExpression: `set ${updateKey} = :value`,
    ExpressionAttributeValues: {
      ':value': updateValue
    },
    ReturnValues: 'UPDATED_NEW'
  }
  return await dynamodb.update(params).promise().then((response) => {
    const body = {
      Operation: 'UPDATE',
      Message: 'SUCCESS',
      UpdatedAttributes: response
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('Do your custom error handling here. I am just gonna log it: ', error);
  })
}

/*This function will delete the record based on the productID*/
/*dynamodb.delete() for deleting*/
async function deleteProduct(productId) {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      'productId': productId
    },
    ReturnValues: 'ALL_OLD'
  }
  return await dynamodb.delete(params).promise().then((response) => {
    const body = {
      Operation: 'DELETE',
      Message: 'SUCCESS',
      Item: response
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('Do your custom error handling here. I am just gonna log it: ', error);
  })
}

/*This is the common function to return the response by taking from above functions as JSON object*/
function buildResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body) /*Converting string to JSON*/
  }
}