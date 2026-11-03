import { FilmDto, ScheduleDto } from '../films/dto/films.dto';
import { CreateOrderDto, OrderResponseDto } from '../order/dto/order.dto';
import { FilmDocument } from '../films/schemas/film.schema';

export interface FilmsRepository {
  findAll(): Promise<FilmDto[]>;
  findSchedule(filmId: string): Promise<ScheduleDto[]>;
  createOrder(order: CreateOrderDto): Promise<OrderResponseDto>;
  findById(filmId: string): Promise<FilmDocument | null>;
}
