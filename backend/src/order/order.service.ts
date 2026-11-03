import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';

import { MongoFilmsRepository } from '../repository/mongo-films.repository';
import { CreateOrderDto, OrderResponseDto } from './dto/order.dto';

@Injectable()
export class OrderService {
  constructor(private readonly filmsRepository: MongoFilmsRepository) {}

  async create(order: CreateOrderDto): Promise<OrderResponseDto> {
    if (!Array.isArray(order.tickets) || order.tickets.length === 0) {
      throw new BadRequestException('Необходимо выбрать хотя бы один билет');
    }

    const selectedSeats = new Set<string>();

    for (const ticket of order.tickets) {
      // Проверяем существование фильма.
      const film = await this.filmsRepository.findById(ticket.film);

      if (!film) {
        throw new BadRequestException('Фильм не найден');
      }

      // Проверяем существование сеанса.
      const filmSession = film.schedule.find(
        (session) => session.id === ticket.session,
      );

      if (!filmSession) {
        throw new BadRequestException('Сеанс не найден');
      }

      // Проверяем корректность ряда и места.
      if (
        !Number.isInteger(ticket.row) ||
        !Number.isInteger(ticket.seat) ||
        ticket.row < 1 ||
        ticket.row > filmSession.rows ||
        ticket.seat < 1 ||
        ticket.seat > filmSession.seats
      ) {
        throw new BadRequestException('Некорректный ряд или место');
      }

      // Проверяем стоимость билета.
      if (ticket.price !== filmSession.price) {
        throw new BadRequestException('Некорректная стоимость билета');
      }

      // Проверяем время сеанса.
      if (ticket.daytime !== filmSession.daytime) {
        throw new BadRequestException('Некорректное время сеанса');
      }

      // Формируем идентификатор места.
      const seatKey = `${ticket.row}:${ticket.seat}`;

      // Проверяем дублирование места внутри одного заказа.
      const uniqueKey = `${ticket.film}:${ticket.session}:${seatKey}`;

      if (selectedSeats.has(uniqueKey)) {
        throw new BadRequestException('Место выбрано дважды');
      }

      selectedSeats.add(uniqueKey);

      // Проверяем, не занято ли место другим пользователем.
      if (filmSession.taken.includes(seatKey)) {
        throw new ConflictException('Место уже занято');
      }
    }

    // Передаём проверенный заказ репозиторию.
    // Репозиторий атомарно сохраняет места в MongoDB.
    return this.filmsRepository.createOrder(order);
  }
}
