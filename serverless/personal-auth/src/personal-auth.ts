import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { Readable } from 'stream';
import {
  AuthUserProfile,
  AuthUserSettings,
  AuthPublicProfile,
  AuthBaseResponse,
  AuthSessionVerificationResponse,
  AuthLoginResponse,
  AuthSignupResponse,
  AuthUpdateSettingsResponse,
  AuthUpdatePhoneVerificationResponse,
  AuthChangePasswordResponse,
  AuthForgotPasswordResponse,
  AuthResetPasswordResponse,
  AuthErrorResponse,
  AuthRegisterCityResponse,
  AuthGetAllUsersResponse,
  AuthAddCityVerificationResponse
} from './types';

const s3Client = new S3Client({ region: 'us-east-1' });
const sesClient = new SESClient({ region: 'us-east-1' });

const isDev = process.env.CITY_VOTE_ENV === 'dev';
const BUCKET_NAME = isDev ? 'city-vote-data-dev' : 'city-vote-data';
const SALT_ROUNDS = 12;

const HOST = 'https://city-vote.com' 
const SES_SENDER = 'info@rixdata.net';

// Common file paths
const USERS_PATH = 'users';
const PUBLIC_PROFILES_PATH = `${USERS_PATH}/public_profiles`;
const PHONE_VERIFICATION_PATH = `${USERS_PATH}/phone_number/verification.csv`;

// Helper function to stream S3 response body to string
async function streamToString(stream: Readable): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: any[] = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

// Helper function to fetch file from S3
async function fetchFileFromS3(key: string): Promise<Record<string, AuthUserProfile>> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    const response = await s3Client.send(command);
    if (!response.Body) {
      return {};
    }
    const data = await streamToString(response.Body as Readable);
    return JSON.parse(data);
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return {};
    }
    throw error;
  }
}

// Helper function to save file to S3
async function saveFileToS3(key: string, data: any): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json'
  });
  await s3Client.send(command);
}

// Generate a secure session token with expiry (31 days from now)
function generateSessionToken(): string {
  const expiryTime = Math.floor(Date.now() / 1000) + (31 * 24 * 60 * 60); // 31 days from now
  return `${crypto.randomBytes(32).toString('hex')}_${expiryTime}`;
}

// Generate user ID
function generateUserId(): string {
  // Generate 16 random bytes and convert to hex for a 32-character string
  return crypto.randomBytes(16).toString('hex');
}

// Send verification email
async function sendVerificationEmail(email: string, verificationToken: string): Promise<void> {
  // Keep URL parameters for the verification link (user-friendly in emails)
  const verificationLink = `${HOST}/verify?email=${encodeURIComponent(email)}&token=${verificationToken}`;
  
  const params = {
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Body: {
        Text: {
          Data: `Please verify your email by clicking this link: ${verificationLink}

Thank you for registering with city-vote.com!`
        }
      },
      Subject: {
        Data: "Verify your city-vote.com account"
      }
    },
    Source: SES_SENDER
  };

  const command = new SendEmailCommand(params);
  await sesClient.send(command);
}

// Default empty settings
const DEFAULT_SETTINGS: AuthUserSettings = {
  firstName: '',
  lastName: '',
  country: ''
};

// Helper function to create error responses
function createErrorResponse(statusCode: number, message: string, details?: string): APIGatewayProxyResult {
  return {
    statusCode,
    body: JSON.stringify({
      message,
      details,
      time: new Date()
    } as AuthErrorResponse)
  };
}

// Helper function to manage public profiles
async function savePublicProfile(userId: string, settings: AuthUserSettings): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: `${PUBLIC_PROFILES_PATH}/${userId}.json`,
    Body: JSON.stringify({
      settings: {
        ...DEFAULT_SETTINGS,
        ...settings
      }
    }, null, 2),
    ContentType: 'application/json'
  });
  await s3Client.send(command);
}

async function getPublicProfile(userId: string): Promise<AuthPublicProfile> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${PUBLIC_PROFILES_PATH}/${userId}.json`,
    });
    const response = await s3Client.send(command);
    if (!response.Body) {
      return { settings: DEFAULT_SETTINGS };
    }
    const data = await streamToString(response.Body as Readable);
    return JSON.parse(data);
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return { settings: DEFAULT_SETTINGS };
    }
    throw error;
  }
}

// Validate session token
async function validateSessionToken(email: string, sessionToken: string): Promise<{ isValid: boolean; user?: AuthUserProfile }> {
  const partition = email.charAt(0).toLowerCase();
  const userFilePath = `${USERS_PATH}/${partition}/users.json`;

  try {
    const users = await fetchFileFromS3(userFilePath);
    const user = users[email];

    if (!user || !user.sessions) {
      return { isValid: false };
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const isValidToken = user.sessions.some(token => {
      const [tokenValue, expiry] = token.split('_');
      return token === sessionToken && parseInt(expiry) > currentTime;
    });

    if (!isValidToken) {
      return { isValid: false };
    }

    return { isValid: true, user };
  } catch (error) {
    console.error('Session validation error:', error);
    return { isValid: false };
  }
}

// Handle email verification
async function handleVerification(email: string, token: string): Promise<APIGatewayProxyResult> {
  try {
    const partition = email.charAt(0).toLowerCase();
    const userFilePath = `${USERS_PATH}/${partition}/users.json`;

    const users = await fetchFileFromS3(userFilePath);
    const user = users[email];

    if (!user) {
      return createErrorResponse(404, 'User not found', 'The verification data is invalid or has expired.');
    }

    if (user.emailVerified) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Already verified',
          details: 'Your email has already been verified. You can now log in to your account.',
          time: new Date()
        } as AuthBaseResponse)
      };
    }

    if (user.emailVerificationToken !== token) {
      return createErrorResponse(400, 'Invalid token', 'The verification data is invalid or has expired.');
    }

    users[email].emailVerified = true;
    users[email].emailVerificationToken = undefined;
    await saveFileToS3(userFilePath, users);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Email verified',
        details: 'Your email has been successfully verified. You can now log in to your account.',
        time: new Date()
      } as AuthBaseResponse)
    };
  } catch (error) {
    console.error('Verification error:', error);
    return createErrorResponse(500, 'Internal server error', 'An error occurred during verification. Please try again later.');
  }
}

// Handle session verification
async function handleSessionVerification(email: string, sessionToken: string): Promise<APIGatewayProxyResult> {
  try {
    const { isValid, user } = await validateSessionToken(email, sessionToken);
    
    if (!isValid || !user) {
      return createErrorResponse(401, 'Invalid or expired session');
    }

    // Fetch settings from public profile
    const publicProfile = await getPublicProfile(user.userId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Session valid',
        emailVerified: user.emailVerified,
        settings: publicProfile.settings || DEFAULT_SETTINGS,
        userId: user.userId,
        isAdmin: user.isAdmin || false,
        phoneVerification: user.phoneVerification || null,
        cityAssociations: user.cityAssociations || [],
        time: new Date()
      } as AuthSessionVerificationResponse)
    };
  } catch (error) {
    console.error('Session verification error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
}

// Handle login
async function handleLogin(email: string, password: string): Promise<APIGatewayProxyResult> {
  const partition = email.charAt(0).toLowerCase();
  const userFilePath = `${USERS_PATH}/${partition}/users.json`;

  try {
    const users = await fetchFileFromS3(userFilePath);
    const user = users[email];
    
    if (!user) {
      return createErrorResponse(401, 'Invalid credentials');
    }

    if (!user.emailVerified) {
      return createErrorResponse(403, 'Please verify your email before logging in');
    }

    const passwordMatch = await bcrypt.compare(password, user.hashedPassword);
    
    if (!passwordMatch) {
      return createErrorResponse(401, 'Invalid credentials');
    }

    const sessionToken = generateSessionToken();
    
    if (!users[email].sessions) {
      users[email].sessions = [];
    }
    
    const currentTime = Math.floor(Date.now() / 1000);
    users[email].sessions = users[email].sessions.filter(token => {
      const [, expiry] = token.split('_');
      return parseInt(expiry) > currentTime;
    });
    
    users[email].sessions.push(sessionToken);
    users[email].lastLogin = new Date().toISOString();

    await saveFileToS3(userFilePath, users);

    // Fetch user settings from public profile
    const publicProfile = await getPublicProfile(user.userId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Login successful',
        sessionToken,
        emailVerified: user.emailVerified,
        settings: publicProfile.settings || DEFAULT_SETTINGS,
        userId: user.userId,
        isAdmin: user.isAdmin || false,
        phoneVerification: user.phoneVerification || null,
        time: new Date()
      } as AuthLoginResponse)
    };
  } catch (error) {
    console.error('Login error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
}

// Validate password strength
function validatePassword(password: string): { isValid: boolean; message?: string } {
  if (!password) {
    return { isValid: false, message: 'Password is required' };
  }

  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }

  const hasUppercase = /[A-Z]/.test(password);
  if (!hasUppercase) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }

  const hasLowercase = /[a-z]/.test(password);
  if (!hasLowercase) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }

  const hasNumber = /[0-9]/.test(password);
  if (!hasNumber) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }

  return { isValid: true };
}

// Handle signup
async function handleSignup(email: string, password: string): Promise<APIGatewayProxyResult> {
  const partition = email.charAt(0).toLowerCase();
  const userFilePath = `${USERS_PATH}/${partition}/users.json`;

  try {
    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      return createErrorResponse(400, passwordValidation.message || 'Invalid password');
    }

    const users = await fetchFileFromS3(userFilePath);

    if (users[email]) {
      return {
        statusCode: 409,
        body: JSON.stringify({
          message: 'Email already registered',
          time: new Date()
        } as AuthErrorResponse)
      };
    }

    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const userId = generateUserId();
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const sessionToken = generateSessionToken();

    users[email] = {
      userId,
      hashedPassword,
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
      sessions: [sessionToken],
      emailVerified: false,
      emailVerificationToken
    };

    try {
      await sendVerificationEmail(email, emailVerificationToken);
      await saveFileToS3(userFilePath, users);

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'User registered successfully. Please check your email to verify your account.',
          sessionToken,
          time: new Date()
        } as AuthSignupResponse)
      };
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Failed to send verification email. Please try signing up again.',
          details: error.message,
          time: new Date()
        } as AuthErrorResponse)
      };
    }
  } catch (error: any) {
    console.error('Signup error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        details: error.message,
        time: new Date()
      } as AuthErrorResponse)
    };
  }
}

// Handle update settings
async function handleUpdateSettings(email: string, sessionToken: string, settings: AuthUserSettings): Promise<APIGatewayProxyResult> {
  const partition = email.charAt(0).toLowerCase();
  const userFilePath = `${USERS_PATH}/${partition}/users.json`;

  try {
    const users = await fetchFileFromS3(userFilePath);
    const user = users[email];

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'User not found',
          time: new Date()
        } as AuthErrorResponse)
      };
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const isValidToken = user?.sessions?.some(token => {
      const [tokenValue, expiry] = token.split('_');
      return token === sessionToken && parseInt(expiry) > currentTime;
    });

    if (!isValidToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: 'Invalid or expired session',
          time: new Date()
        } as AuthErrorResponse)
      };
    }

    // Validate settings fields
    const allowedFields = [
      'firstName',
      'lastName',
      'country'
    ];

    const validatedSettings: AuthUserSettings = {};
    for (const [key, value] of Object.entries(settings)) {
      // Check if the field is allowed
      if (!allowedFields.includes(key)) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: `Invalid setting field: ${key}`,
            time: new Date()
          } as AuthErrorResponse)
        };
      }

      // Type validation
      if (typeof value !== 'string') {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: `${key} must be a string`,
            time: new Date()
          } as AuthErrorResponse)
        };
      }

      // Type assertion to handle dynamic property assignment
      (validatedSettings as any)[key] = value;
    }

    // Get existing public profile
    const publicProfile = await getPublicProfile(user.userId);
    
    // Update settings with new fields and timestamp
    const updatedSettings: AuthUserSettings = {
      ...publicProfile.settings,
      ...validatedSettings,
      lastUpdated: new Date().toISOString()
    };

    // Save to public profile
    await savePublicProfile(user.userId, updatedSettings);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Settings updated successfully',
        settings: updatedSettings,
        time: new Date()
      } as AuthUpdateSettingsResponse)
    };
  } catch (error) {
    console.error('Settings update error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        time: new Date()
      } as AuthErrorResponse)
    };
  }
}

// Handle change password
async function handleChangePassword(email: string, sessionToken: string, currentPassword: string, newPassword: string): Promise<APIGatewayProxyResult> {
  const partition = email.charAt(0).toLowerCase();
  const userFilePath = `${USERS_PATH}/${partition}/users.json`;

  try {
    const users = await fetchFileFromS3(userFilePath);
    const user = users[email];

    if (!user) {
      return createErrorResponse(404, 'User not found');
    }

    // Validate session token
    const currentTime = Math.floor(Date.now() / 1000);
    const isValidToken = user?.sessions?.some(token => {
      const [tokenValue, expiry] = token.split('_');
      return token === sessionToken && parseInt(expiry) > currentTime;
    });

    if (!isValidToken) {
      return createErrorResponse(401, 'Invalid or expired session');
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, user.hashedPassword);
    if (!passwordMatch) {
      return createErrorResponse(400, 'Current password is incorrect');
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return createErrorResponse(400, passwordValidation.message || 'Invalid new password');
    }

    // Check if new password is different from current password
    const samePassword = await bcrypt.compare(newPassword, user.hashedPassword);
    if (samePassword) {
      return createErrorResponse(400, 'New password must be different from current password');
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update user's password
    users[email].hashedPassword = hashedNewPassword;

    // Invalidate all existing sessions except the current one for security
    users[email].sessions = users[email].sessions.filter(token => {
      const [, expiry] = token.split('_');
      return token === sessionToken && parseInt(expiry) > currentTime;
    });

    await saveFileToS3(userFilePath, users);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Password changed successfully',
        time: new Date()
      } as AuthChangePasswordResponse)
    };
  } catch (error) {
    console.error('Change password error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
}

// Send password reset email
async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  const resetLink = `${HOST}/reset-password?email=${encodeURIComponent(email)}&token=${resetToken}`;
  
  const params = {
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Body: {
        Text: {
          Data: `You have requested to reset your password for your city-vote.com account.

Please click the following link to reset your password:
${resetLink}

This link will expire in 1 hour for security reasons.

If you did not request this password reset, please ignore this email.

Thank you,
The city-vote.com team`
        }
      },
      Subject: {
        Data: "Reset your city-vote.com password"
      }
    },
    Source: SES_SENDER
  };

  const command = new SendEmailCommand(params);
  await sesClient.send(command);
}

// Handle forgot password
async function handleForgotPassword(email: string): Promise<APIGatewayProxyResult> {
  const partition = email.charAt(0).toLowerCase();
  const userFilePath = `${USERS_PATH}/${partition}/users.json`;

  try {
    const users = await fetchFileFromS3(userFilePath);
    const user = users[email];

    if (!user) {
      // For security reasons, don't reveal if the email exists or not
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'If an account with that email exists, a password reset link has been sent.',
          time: new Date()
        } as AuthForgotPasswordResponse)
      };
    }

    if (!user.emailVerified) {
      return createErrorResponse(403, 'Please verify your email before requesting a password reset');
    }

    // Generate password reset token (valid for 1 hour)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now

    // Update user with reset token
    users[email].passwordResetToken = resetToken;
    users[email].passwordResetExpiry = resetExpiry;

    await saveFileToS3(userFilePath, users);

    try {
      await sendPasswordResetEmail(email, resetToken);
    } catch (emailError) {
      console.error('Error sending password reset email:', emailError);
      return createErrorResponse(500, 'Failed to send password reset email. Please try again later.');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'If an account with that email exists, a password reset link has been sent.',
        time: new Date()
      } as AuthForgotPasswordResponse)
    };
  } catch (error) {
    console.error('Forgot password error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
}

// Handle reset password
async function handleResetPassword(email: string, resetToken: string, newPassword: string): Promise<APIGatewayProxyResult> {
  const partition = email.charAt(0).toLowerCase();
  const userFilePath = `${USERS_PATH}/${partition}/users.json`;

  try {
    const users = await fetchFileFromS3(userFilePath);
    const user = users[email];

    if (!user) {
      return createErrorResponse(404, 'Invalid or expired reset token');
    }

    // Check if reset token exists and is valid
    if (!user.passwordResetToken || user.passwordResetToken !== resetToken) {
      return createErrorResponse(400, 'Invalid or expired reset token');
    }

    // Check if reset token has expired
    if (!user.passwordResetExpiry || new Date() > new Date(user.passwordResetExpiry)) {
      return createErrorResponse(400, 'Invalid or expired reset token');
    }

    // Validate new password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      return createErrorResponse(400, passwordValidation.message || 'Invalid password');
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update user's password and clear reset token
    users[email].hashedPassword = hashedNewPassword;
    users[email].passwordResetToken = undefined;
    users[email].passwordResetExpiry = undefined;

    // Invalidate all existing sessions for security
    users[email].sessions = [];

    await saveFileToS3(userFilePath, users);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Password reset successfully. Please log in with your new password.',
        time: new Date()
      } as AuthResetPasswordResponse)
    };
  } catch (error) {
    console.error('Reset password error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
}

// Validate phone token
async function validatePhoneToken(phoneNumber: string, token: string): Promise<boolean> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: PHONE_VERIFICATION_PATH
    });
    const response = await s3Client.send(command);
    if (!response.Body) {
      return false;
    }
    
    const data = await streamToString(response.Body as Readable);
    const lines = data.split('\n');
    const monthInMs = 31 * 24 * 60 * 60 * 1000; // One month in milliseconds
    
    for (let i = 1; i < lines.length; i++) { // Skip header
      const [timestamp, storedPhone, storedToken] = lines[i].split(',');
      if (!storedPhone || !storedToken || !timestamp) continue;
      
      // Check if this verification is for the same phone and token
      if (storedPhone === phoneNumber && storedToken === token) {
        const verificationTime = parseInt(timestamp);
        const now = Date.now();
        // Verify that the token is not older than one month
        if (now - verificationTime < monthInMs) {
          return true;
        }
      }
    }
    return false;
  } catch (error) {
    console.error('Error validating phone token:', error);
    return false;
  }
}

// Handle city registration request
async function handleCityRegistration(
  email: string,
  sessionToken: string,
  cityId: string
): Promise<APIGatewayProxyResult> {
  const partition = email.charAt(0).toLowerCase();
  const userFilePath = `${USERS_PATH}/${partition}/users.json`;
  const registrationFilePath = 'registration/registration.json';

  try {
    // Validate session token
    const { isValid, user } = await validateSessionToken(email, sessionToken);
    
    if (!isValid || !user) {
      return createErrorResponse(401, 'Invalid or expired session');
    }

    // Check if user's email is verified
    if (!user.emailVerified) {
      return createErrorResponse(403, 'Please verify your email before submitting a city registration request');
    }

    // Get existing registration data
    let registrations: Record<string, any> = {};
    try {
      const registrationData = await s3Client.send(new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: registrationFilePath
      }));

      if (registrationData.Body) {
        const registrationString = await streamToString(registrationData.Body as Readable);
        registrations = JSON.parse(registrationString);
      }
    } catch (error) {
      console.error('Error getting registration data:', error);
      // If the file doesn't exist yet, we'll create it
    }

    // Check if city with same ID already exists in registration.json
    if (registrations[cityId]) {
      return createErrorResponse(409, `City with ID "${cityId}" already exists in registration data`);
    }

    // Create city registration with user ID
    const city = {
      id: cityId,
      name: cityId, // Using cityId as name temporarily, will be enriched later
      userId: user.userId,
      email: email,
      registeredAt: new Date().toISOString(),
      status: 'pending' // Add status to indicate pending verification
    };

    // Add the city to the registration data
    registrations[cityId] = city;

    // Update the registration data
    await saveFileToS3(registrationFilePath, registrations);

    // Send email notification to info@rixdata.net
    try {
      const params = {
        Destination: {
          ToAddresses: [SES_SENDER] // Send to info@rixdata.net
        },
        Message: {
          Body: {
            Text: {
              Data: `New city registration request:
              
City ID: ${cityId}
User Email: ${email}
User ID: ${user.userId}
Timestamp: ${city.registeredAt}

This registration requires manual verification before the city is added to the system.`
            }
          },
          Subject: {
            Data: "New City Registration Request"
          }
        },
        Source: SES_SENDER
      };

      const command = new SendEmailCommand(params);
      await sesClient.send(command);
    } catch (emailError) {
      console.error('Error sending registration notification email:', emailError);
      // Continue even if email fails - we've already saved to S3
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Registration request submitted successfully. After manual verification, the city will be added to the system.',
        cityId,
        time: new Date()
      } as AuthRegisterCityResponse)
    };
  } catch (error) {
    console.error('City registration error:', error);
    return createErrorResponse(500, 'Internal server error');
  }
}

// Handle phone verification
async function handlePhoneVerification(
  email: string, 
  sessionToken: string, 
  phoneData: { phoneNumber: string; token: string; timestamp: string }
): Promise<APIGatewayProxyResult> {
  const partition = email.charAt(0).toLowerCase();
  const userFilePath = `${USERS_PATH}/${partition}/users.json`;

  try {
    const users = await fetchFileFromS3(userFilePath);
    const user = users[email];

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'User not found',
          time: new Date()
        } as AuthErrorResponse)
      };
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const isValidToken = user?.sessions?.some(token => {
      const [tokenValue, expiry] = token.split('_');
      return token === sessionToken && parseInt(expiry) > currentTime;
    });

    if (!isValidToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: 'Invalid or expired session',
          time: new Date()
        } as AuthErrorResponse)
      };
    }

    // Validate the phone token
    const isValidPhoneToken = await validatePhoneToken(phoneData.phoneNumber, phoneData.token);
    if (!isValidPhoneToken) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: 'Invalid or expired phone verification',
          time: new Date()
        } as AuthErrorResponse)
      };
    }

    // Update user's phone verification data
    users[email].phoneVerification = {
      phoneNumber: phoneData.phoneNumber,
      token: phoneData.token,
      timestamp: phoneData.timestamp
    };

    await saveFileToS3(userFilePath, users);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Phone verification updated successfully',
        phoneVerification: users[email].phoneVerification,
        time: new Date()
      } as AuthUpdatePhoneVerificationResponse)
    };
  } catch (error) {
    console.error('Phone verification update error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        time: new Date()
      } as AuthErrorResponse)
    };
  }
}

// Extract authorization token from headers
function extractSessionToken(headers: { [name: string]: string | undefined }): string | undefined {
  if (!headers.authorization) {
    return undefined;
  }

  try {
    // Authorization header should be in format: "Bearer sessionToken"
    const authParts = headers.authorization.split(' ');
    if (authParts.length !== 2 || authParts[0] !== 'Bearer') {
      return undefined;
    }

    return authParts[1];
  } catch (error) {
    console.error('Error extracting session token:', error);
    return undefined;
  }
}

// Handle get all users (admin only)
async function handleGetAllUsers(email: string, sessionToken: string): Promise<APIGatewayProxyResult> {
  const partition = email.charAt(0).toLowerCase();
  const userFilePath = `${USERS_PATH}/${partition}/users.json`;

  try {
    const users = await fetchFileFromS3(userFilePath);
    const user = users[email];

    if (!user) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'User not found',
          time: new Date()
        } as AuthErrorResponse)
      };
    }

    // Verify session token
    const currentTime = Math.floor(Date.now() / 1000);
    const isValidToken = user?.sessions?.some(token => {
      const [tokenValue, expiry] = token.split('_');
      return token === sessionToken && parseInt(expiry) > currentTime;
    });

    if (!isValidToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: 'Invalid or expired session',
          time: new Date()
        } as AuthErrorResponse)
      };
    }

    // Check if user is admin
    if (!user.isAdmin) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          message: 'Access denied. Administrator privileges required.',
          time: new Date()
        } as AuthErrorResponse)
      };
    }

    // Fetch all users from all partitions
    const allUsers: Array<{
      email: string;
      userId: string;
      createdAt: string;
      emailVerified: boolean;
      cityAssociations?: any[];
    }> = [];

    // Iterate through all possible partitions (a-z, 0-9)
    const partitions = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
    
    for (const partition of partitions) {
      try {
        const partitionFilePath = `${USERS_PATH}/${partition}/users.json`;
        const partitionUsers = await fetchFileFromS3(partitionFilePath);
        
        // Add users from this partition (excluding sensitive data)
        for (const [userEmail, userData] of Object.entries(partitionUsers)) {
          allUsers.push({
            email: userEmail,
            userId: userData.userId,
            createdAt: userData.createdAt,
            emailVerified: userData.emailVerified,
            cityAssociations: userData.cityAssociations || []
          });
        }
      } catch (error) {
        // Partition file doesn't exist or is empty, continue to next partition
        continue;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Users retrieved successfully',
        users: allUsers,
        time: new Date()
      } as AuthGetAllUsersResponse)
    };

  } catch (error: any) {
    console.error('Get all users error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        details: error.message,
        time: new Date()
      } as AuthErrorResponse)
    };
  }
}

// Handle add city verification (admin only)
async function handleAddCityVerification(
  email: string,
  sessionToken: string,
  targetUserEmail: string,
  verification: {
    cityId: string;
    title: string;
    isAuthorisedRepresentative: boolean;
    confidence: number;
    time: string;
  }
): Promise<APIGatewayProxyResult> {
  const partition = email.charAt(0).toLowerCase();
  const userFilePath = `${USERS_PATH}/${partition}/users.json`;

  try {
    const users = await fetchFileFromS3(userFilePath);
    const adminUser = users[email];

    if (!adminUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'Admin user not found',
          time: new Date()
        } as AuthErrorResponse)
      };
    }

    // Verify admin session token
    const currentTime = Math.floor(Date.now() / 1000);
    const isValidToken = adminUser?.sessions?.some(token => {
      const [tokenValue, expiry] = token.split('_');
      return token === sessionToken && parseInt(expiry) > currentTime;
    });

    if (!isValidToken) {
      return {
        statusCode: 401,
        body: JSON.stringify({
          message: 'Invalid or expired session',
          time: new Date()
        } as AuthErrorResponse)
      };
    }

    // Check if user is admin
    if (!adminUser.isAdmin) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          message: 'Access denied. Administrator privileges required.',
          time: new Date()
        } as AuthErrorResponse)
      };
    }

    // Find the target user
    const targetPartition = targetUserEmail.charAt(0).toLowerCase();
    const targetUserFilePath = `${USERS_PATH}/${targetPartition}/users.json`;
    const targetUsers = await fetchFileFromS3(targetUserFilePath);
    const targetUser = targetUsers[targetUserEmail];

    if (!targetUser) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: 'Target user not found',
          time: new Date()
        } as AuthErrorResponse)
      };
    }

    // Create the city association
    const cityAssociation = {
      cityId: verification.cityId,
      title: verification.title,
      isAuthorisedRepresentative: verification.isAuthorisedRepresentative,
      confidence: verification.confidence,
      identityVerifiedBy: adminUser.representingCityNetwork || 'Unknown',
      time: verification.time
    };

    // Add the city association to the target user
    if (!targetUser.cityAssociations) {
      targetUser.cityAssociations = [];
    }
    targetUser.cityAssociations.push(cityAssociation);

    // Save the updated target user data
    await saveFileToS3(targetUserFilePath, targetUsers);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'City verification added successfully',
        verification: cityAssociation,
        time: new Date()
      } as AuthAddCityVerificationResponse)
    };

  } catch (error: any) {
    console.error('Add city verification error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Internal server error',
        details: error.message,
        time: new Date()
      } as AuthErrorResponse)
    };
  }
}

// Lambda handler
export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Handle email verification via query parameters (for email verification links)
  if (event.queryStringParameters?.email && event.queryStringParameters?.token) {
    const email = event.queryStringParameters.email;
    const token = event.queryStringParameters.token;
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return createErrorResponse(400, 'Invalid email format');
    }
    
    return handleVerification(email, token);
  }

  // Parse request body for other actions
  if (!event.body) {
    return createErrorResponse(400, 'Missing request body');
  }

  let requestData;
  try {
    requestData = JSON.parse(event.body);
  } catch (error) {
    return createErrorResponse(400, 'Invalid JSON in request body');
  }

  const { action } = requestData;

  if (!action) {
    return createErrorResponse(400, 'Missing required field: action');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Handle different actions
  switch (action) {

    case 'verifySessionToken':
      // Use auth header for session token and email from request body
      const { email: verifyEmail } = requestData;
      const sessionToken = extractSessionToken(event.headers);
      
      if (!verifyEmail || !sessionToken) {
        return createErrorResponse(401, 'Missing email or session token');
      }
      
      if (!emailRegex.test(verifyEmail)) {
        return createErrorResponse(400, 'Invalid email format');
      }
      
      return handleSessionVerification(verifyEmail, sessionToken);

    case 'login':
      const { email: loginEmail, password } = requestData;
      if (!loginEmail || !password) {
        return createErrorResponse(400, 'Missing required fields');
      }
      
      if (!emailRegex.test(loginEmail)) {
        return createErrorResponse(400, 'Invalid email format');
      }
      
      return handleLogin(loginEmail, password);

    case 'signup':
      const { email: signupEmail, password: signupPassword } = requestData;
      if (!signupEmail || !signupPassword) {
        return createErrorResponse(400, 'Missing required fields');
      }
      
      if (!emailRegex.test(signupEmail)) {
        return createErrorResponse(400, 'Invalid email format');
      }
      
      return handleSignup(signupEmail, signupPassword);

    case 'updateSettings':
      const { email: settingsEmail, settings } = requestData;
      const settingsToken = extractSessionToken(event.headers);
      
      if (!settingsEmail || !settingsToken) {
        return createErrorResponse(401, 'Missing email or session token');
      }
      
      if (!settings) {
        return createErrorResponse(400, 'Missing settings data');
      }
      
      if (!emailRegex.test(settingsEmail)) {
        return createErrorResponse(400, 'Invalid email format');
      }
      
      return handleUpdateSettings(settingsEmail, settingsToken, settings);

    case 'changePassword':
      const { email: changePasswordEmail, currentPassword, newPassword } = requestData;
      const changePasswordToken = extractSessionToken(event.headers);
      
      if (!changePasswordEmail || !changePasswordToken) {
        return createErrorResponse(401, 'Missing email or session token');
      }
      
      if (!currentPassword || !newPassword) {
        return createErrorResponse(400, 'Missing current password or new password');
      }
      
      if (!emailRegex.test(changePasswordEmail)) {
        return createErrorResponse(400, 'Invalid email format');
      }
      
      return handleChangePassword(changePasswordEmail, changePasswordToken, currentPassword, newPassword);

    case 'forgotPassword':
      const { email: forgotPasswordEmail } = requestData;
      
      if (!forgotPasswordEmail) {
        return createErrorResponse(400, 'Missing email');
      }
      
      if (!emailRegex.test(forgotPasswordEmail)) {
        return createErrorResponse(400, 'Invalid email format');
      }
      
      return handleForgotPassword(forgotPasswordEmail);

    case 'resetPassword':
      const { email: resetPasswordEmail, resetToken, newPassword: resetNewPassword } = requestData;
      
      if (!resetPasswordEmail || !resetToken || !resetNewPassword) {
        return createErrorResponse(400, 'Missing required fields');
      }
      
      if (!emailRegex.test(resetPasswordEmail)) {
        return createErrorResponse(400, 'Invalid email format');
      }
      
      return handleResetPassword(resetPasswordEmail, resetToken, resetNewPassword);

    case 'updatePhoneVerification':
      const { email: phoneEmail, phoneData } = requestData;
      const phoneToken = extractSessionToken(event.headers);
      
      if (!phoneEmail || !phoneToken) {
        return createErrorResponse(401, 'Missing email or session token');
      }
      
      if (!phoneData) {
        return createErrorResponse(400, 'Missing phone verification data');
      }
      
      if (!emailRegex.test(phoneEmail)) {
        return createErrorResponse(400, 'Invalid email format');
      }
      
      return handlePhoneVerification(phoneEmail, phoneToken, phoneData);
      
    case 'registerCity':
      const { email: cityEmail, cityId } = requestData;
      const cityToken = extractSessionToken(event.headers);
      
      if (!cityEmail || !cityToken) {
        return createErrorResponse(401, 'Missing email or session token');
      }
      
      if (!cityId) {
        return createErrorResponse(400, 'Missing cityId');
      }
      
      if (!emailRegex.test(cityEmail)) {
        return createErrorResponse(400, 'Invalid email format');
      }
      
      return handleCityRegistration(cityEmail, cityToken, cityId);

    case 'getAllUsers':
      const { email: adminEmail } = requestData;
      const adminToken = extractSessionToken(event.headers);
      
      if (!adminEmail || !adminToken) {
        return createErrorResponse(401, 'Missing email or session token');
      }
      
      if (!emailRegex.test(adminEmail)) {
        return createErrorResponse(400, 'Invalid email format');
      }
      
      return handleGetAllUsers(adminEmail, adminToken);

    case 'addCityVerification':
      const { email: verifyAdminEmail, targetUserEmail, verification } = requestData;
      const verifyAdminToken = extractSessionToken(event.headers);
      
      if (!verifyAdminEmail || !verifyAdminToken) {
        return createErrorResponse(401, 'Missing email or session token');
      }
      
      if (!targetUserEmail || !verification) {
        return createErrorResponse(400, 'Missing target user email or verification data');
      }
      
      if (!emailRegex.test(verifyAdminEmail) || !emailRegex.test(targetUserEmail)) {
        return createErrorResponse(400, 'Invalid email format');
      }
      
      return handleAddCityVerification(verifyAdminEmail, verifyAdminToken, targetUserEmail, verification);

    default:
      return createErrorResponse(400, 'Invalid action');
  }
};
