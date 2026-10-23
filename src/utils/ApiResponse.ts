import type { Response, Request } from "express";


class ApiResponse {

    static success(res: Response, options: any) {
        const { data = null, message = 'Success', statusCode = 200 } = options;

        const response = {
            success: true,
            message,
            data,
        };

        return res.status(statusCode).json(response);
    }

    /**
     * Send error response
     */
    static error(res: Response, options: any) {


        const {
            message = 'An error occurred',
            statusCode = 500,
            error,
        } = options;



        const resolvedError = error || (statusCode >= 500 ? 'Internal Server Error' : message);


        const response = {
            success: false,
            error: resolvedError,
            message,
        };


        return res.status(statusCode).json(response);
    }

}

export default ApiResponse;