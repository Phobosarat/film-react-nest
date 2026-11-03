import { Injectable } from '@nestjs/common';
import { MongoFilmsRepository } from '../repository/mongo-films.repository';
import { FilmsResponseDto, ScheduleResponseDto } from './dto/films.dto';

@Injectable()
export class FilmsService {
  constructor(private readonly filmsRepository: MongoFilmsRepository) {}

  async findAll(): Promise<FilmsResponseDto> {
    const films = await this.filmsRepository.findAll();

    return {
      total: films.length,
      items: films,
    };
  }

  async findSchedule(id: string): Promise<ScheduleResponseDto> {
    const schedule = await this.filmsRepository.findSchedule(id);

    return {
      total: schedule.length,
      items: schedule,
    };
  }
}
