import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';
import { isUUID } from 'class-validator';

@Injectable()
export class ParseUuidParamPipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    const field = metadata.data ?? 'id';

    if (!isUUID(value)) {
      throw new BadRequestException({
        message: 'Validation failed',
        details: [{ field, message: `${field} must be a valid UUID` }],
      });
    }

    return value;
  }
}
