const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const region = process.env.AWS_REGION || "ap-southeast-2";
const secretsManagerClient = new SecretsManagerClient({ region: region });
const ssmClient = new SSMClient({ region: region });

let jwtSecret = null;
let jwtSecretInitialised = false;
let _resolveJwtSecretInitialised;

let cognitoClientSecret = null;
let cognitoClientSecretInitialised = false;
let _resolveCognitoClientSecretInitialised;

async function getJwtSecret() {
    if (jwtSecretInitialised) {
        return jwtSecret;
    }

    try {
        const secret_name = "n11051337-A2-JWT";
        const response = await secretsManagerClient.send(
            new GetSecretValueCommand({
                SecretId: secret_name
            })
        );

        if (response.SecretString) {
            const secrets = JSON.parse(response.SecretString);
            jwtSecret = secrets.JWT_SECRET;
            jwtSecretInitialised = true;
            if (_resolveJwtSecretInitialised) _resolveJwtSecretInitialised();
            return jwtSecret;
        }
    } catch (error) {
        console.error("Error retrieving JWT secret from AWS Secrets Manager:", error);
        process.exit(1);
    }
}

async function getCognitoClientSecret() {
    if (cognitoClientSecretInitialised) {
        return cognitoClientSecret;
    }

    try {
        const parameter_name = "CAB432_A2_COGNITO_CLIENT_SECRET";
        const response = await ssmClient.send(
            new GetParameterCommand({
                Name: parameter_name,
                WithDecryption: true // Assuming it might be stored as SecureString
            })
        );

        if (response.Parameter && response.Parameter.Value) {
            cognitoClientSecret = response.Parameter.Value;
            cognitoClientSecretInitialised = true;
            if (_resolveCognitoClientSecretInitialised) _resolveCognitoClientSecretInitialised();
            return cognitoClientSecret;
        }
    } catch (error) {
        console.error("Error retrieving Cognito Client Secret from AWS Parameter Store:", error);
        process.exit(1);
    }
}

const jwtInitialisedPromise = new Promise(resolve => {
    _resolveJwtSecretInitialised = resolve;
});

const cognitoClientSecretInitialisedPromise = new Promise(resolve => {
    _resolveCognitoClientSecretInitialised = resolve;
});

getJwtSecret();
getCognitoClientSecret();

module.exports = {
    getJwtSecret: async () => {
        if (!jwtSecretInitialised) {
            await jwtInitialisedPromise;
        }
        return jwtSecret;
    },
    getCognitoClientSecret: async () => {
        if (!cognitoClientSecretInitialised) {
            await cognitoClientSecretInitialisedPromise;
        }
        return cognitoClientSecret;
    }
};