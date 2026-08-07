import pkg from "../package.json";

export const LOGIN_PATH = "/login";

// Version kommt aus der package.json — nie wieder händisch pflegen
export const APP_VERSION: string = pkg.version;
