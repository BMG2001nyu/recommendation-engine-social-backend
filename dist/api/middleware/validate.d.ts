import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
export declare function validateBody<T>(schema: z.ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => void;
export declare function validateQuery<T>(schema: z.ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=validate.d.ts.map