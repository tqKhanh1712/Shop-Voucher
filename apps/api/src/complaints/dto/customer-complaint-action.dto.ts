import { IsInt, Min } from 'class-validator';

export class CustomerComplaintActionDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
