import { HOST } from "./constants";

export function buildURL(projectID: string, path: string): string {
    return `${HOST}/api/integrations/${projectID}/public-commerce${path}`;
}
