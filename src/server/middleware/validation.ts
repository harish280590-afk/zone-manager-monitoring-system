import { Request, Response, NextFunction } from 'express';

export const validateBody = (requiredFields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing: string[] = [];
    
    for (const field of requiredFields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        missing.push(field);
      }
    }
    
    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Missing required fields: ${missing.join(', ')}`,
        missingFields: missing
      });
    }
    
    next();
  };
};

export const validateCoordinates = (latField: string, lngField: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const lat = parseFloat(req.body[latField]);
    const lng = parseFloat(req.body[lngField]);
    
    if (isNaN(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Field '${latField}' must be a valid latitude between -90 and 90.`
      });
    }
    
    if (isNaN(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({
        error: 'Validation Error',
        message: `Field '${lngField}' must be a valid longitude between -180 and 180.`
      });
    }
    
    next();
  };
};
