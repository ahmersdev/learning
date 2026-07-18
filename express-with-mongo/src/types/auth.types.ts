export interface ISignupBody {
  fullName: string;
  username: string;
  email: string;
  password: string;
}

export interface ISigninBody {
  username?: string;
  email?: string;
  password: string;
}
