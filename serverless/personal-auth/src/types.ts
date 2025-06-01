// City association structure
export interface CityAssociation {
  cityId: string;
  title: string;
  isAuthorisedRepresentative: boolean;
  confidence: number; // 0-1
  identityVerifiedBy: string; // userId
  time: string; // ISO string
}

// User data structure
export interface AuthUserProfile {
  userId: string;
  hashedPassword: string;
  createdAt: string;
  lastLogin: string;
  sessions: string[];
  emailVerified: boolean;
  emailVerificationToken?: string;
  phoneVerification?: {
    phoneNumber: string;
    token: string;
    timestamp: string;
  };
  cityAssociations?: CityAssociation[];
}

export interface AuthUserSettings {
  firstName?: string;
  lastName?: string;
  country?: string;
  lastUpdated?: string;
}

export interface AuthPublicProfile {
  settings: AuthUserSettings;
}

// Request types
export interface AuthBaseRequest {
  action: string;
  email: string;
}

export interface AuthVerifySessionTokenRequest extends AuthBaseRequest {
  action: 'verifySessionToken';
  sessionToken: string;
}

export interface AuthLoginRequest extends AuthBaseRequest {
  action: 'login';
  password: string;
}

export interface AuthSignupRequest extends AuthBaseRequest {
  action: 'signup';
  password: string;
}

export interface AuthUpdateSettingsRequest extends AuthBaseRequest {
  action: 'updateSettings';
  sessionToken: string;
  settings: AuthUserSettings;
}

export interface AuthUpdatePhoneVerificationRequest extends AuthBaseRequest {
  action: 'updatePhoneVerification';
  sessionToken: string;
  phoneData: {
    phoneNumber: string;
    token: string;
    timestamp: string;
  };
}

// Response types
export interface AuthBaseResponse {
  message: string;
  time: Date;
}

export interface AuthSessionVerificationResponse extends AuthBaseResponse {
  emailVerified: boolean;
  settings: AuthUserSettings;
  userId: string;
  phoneVerification: {
    phoneNumber: string;
    token: string;
    timestamp: string;
  } | null;
}

export interface AuthLoginResponse extends AuthSessionVerificationResponse {
  sessionToken: string;
}

export interface AuthSignupResponse extends AuthBaseResponse {
  sessionToken: string;
}

export interface AuthUpdateSettingsResponse extends AuthBaseResponse {
  settings: AuthUserSettings;
}

export interface AuthUpdatePhoneVerificationResponse extends AuthBaseResponse {
  phoneVerification: {
    phoneNumber: string;
    token: string;
    timestamp: string;
  };
}

export interface AuthErrorResponse extends AuthBaseResponse {
  details?: string;
}

// City registration types
export interface AuthRegisterCityRequest extends AuthBaseRequest {
  action: 'registerCity';
  cityId: string;
}

export interface AuthRegisterCityResponse extends AuthBaseResponse {
  cityId: string;
}
