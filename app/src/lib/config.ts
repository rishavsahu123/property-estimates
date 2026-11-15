// Public app settings. The Google client ID is not a secret: it only names this app to Google.
export const GOOGLE_CLIENT_ID = "168318053734-cedchlvnkf4dbpgsgsrna6cvde510h0b.apps.googleusercontent.com";
export const GOOGLE_SCOPES = "openid email profile https://www.googleapis.com/auth/drive.file";
/** visible folder in the user's Drive that holds the backups */
export const DRIVE_FOLDER = "Property Estimates backups";
/** how many backups to keep in that folder (older ones are removed) */
export const DRIVE_KEEP = 3;
