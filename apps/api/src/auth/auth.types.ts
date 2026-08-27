export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "OPERATOR";
};

export type AccessTokenPayload = {
  sub: string;
  email: string;
  name: string;
  role: "ADMIN" | "OPERATOR";
  sid: string;
};
