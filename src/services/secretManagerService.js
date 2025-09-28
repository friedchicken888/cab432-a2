const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

let secretsManagerClient = null;
let ssmClient = null;

let jwtSecret = null;
let cognitoClientSecret = null;

(async () => {
    let awsRegion = null;
    try {
        const client = new SSMClient({ region: process.env.AWS_REGION || "ap-southeast-2" });
        const command = new GetParameterCommand({
            Name: '/n11051337/aws_region',
            WithDecryption: true,
        });
        const response = await client.send(command);
        if (response.Parameter && response.Parameter.Value) {
            awsRegion = response.Parameter.Value;
        } else {
            console.error('Failed to retrieve AWS_REGION from Parameter Store. Exiting application.');
            process.exit(1);
        }
    } catch (error) {
        console.error('Error fetching AWS_REGION from Parameter Store during initialisation:', error);
        process.exit(1);
    }

    secretsManagerClient = new SecretsManagerClient({ region: awsRegion });
    ssmClient = new SSMClient({ region: awsRegion });
})();

module.exports = {
    getJwtSecret: async () => {
        if (jwtSecret) {
            return jwtSecret;
        }

        if (!secretsManagerClient) {
            console.error('SecretsManagerClient not initialised. Exiting.');
            process.exit(1);
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
                return jwtSecret;
            } else {
                console.log('response.SecretString was null or empty for JWT secret.');
            }
        } catch (error) {
            console.error("Error retrieving JWT secret from AWS Secrets Manager:", error);
            process.exit(1);
        }
        return null;
    },
    getCognitoClientSecret: async () => {
        if (cognitoClientSecret) {
            return cognitoClientSecret;
        }

        if (!secretsManagerClient) {
            console.error('SecretsManagerClient not initialised. Exiting.');
            process.exit(1);
        }

        try {
            const secret_name = "n11051337-A2-Cognito";
            const response = await secretsManagerClient.send(
                new GetSecretValueCommand({
                    SecretId: secret_name
                })
            );

            if (response.SecretString) {
                const secrets = JSON.parse(response.SecretString);
                cognitoClientSecret = secrets.AWS_COGNITO_CLIENT_SECRET;
                return cognitoClientSecret;
            } else {
                console.log('response.SecretString was null or empty.');
            }
        } catch (error) {
            console.error("Error retrieving Cognito Client Secret from AWS Secrets Manager:", error);
            process.exit(1);
        }
        return null;
    },
    getParameter: async (parameterName) => {
        if (!ssmClient) {
            console.error('SSMClient not initialised. Exiting.');
            process.exit(1);
        }

        try {
            const command = new GetParameterCommand({
                Name: parameterName,
                WithDecryption: true,
            });
            const response = await ssmClient.send(command);
            if (response.Parameter && response.Parameter.Value) {
                return response.Parameter.Value;
            }
        } catch (error) {
            console.error(`Error retrieving parameter ${parameterName} from AWS Parameter Store:`, error);
            process.exit(1);
        }
        return null;
    },
};