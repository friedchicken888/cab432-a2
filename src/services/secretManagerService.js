const { SecretsManagerClient, GetSecretValueCommand } = require("@aws-sdk/client-secrets-manager");

const region = process.env.AWS_REGION || "ap-southeast-2";
const secretsManagerClient = new SecretsManagerClient({ region: region });

let jwtSecret = null;
let cognitoClientSecret = null;

module.exports = {
    getJwtSecret: async () => {
        if (jwtSecret) {
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
                console.log('Secrets object (JWT):', secrets); // Debug log
                jwtSecret = secrets.JWT_SECRET;
                console.log('Retrieved jwtSecret:', jwtSecret); // Debug log
                return jwtSecret;
            } else {
                console.log('response.SecretString was null or empty for JWT secret.'); // Debug log
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

        try {
            const secret_name = "n11051337-A2-Cognito";
            const response = await secretsManagerClient.send(
                new GetSecretValueCommand({
                    SecretId: secret_name
                })
            );

            if (response.SecretString) {
                const secrets = JSON.parse(response.SecretString);
                console.log('Secrets object:', secrets); // Debug log
                cognitoClientSecret = secrets.AWS_COGNITO_CLIENT_SECRET;
                console.log('Retrieved cognitoClientSecret:', cognitoClientSecret); // Debug log
                return cognitoClientSecret;
            } else {
                console.log('response.SecretString was null or empty.'); // Debug log
            }
        } catch (error) {
            console.error("Error retrieving Cognito Client Secret from AWS Secrets Manager:", error);
            process.exit(1);
        }
        return null;
    }
};