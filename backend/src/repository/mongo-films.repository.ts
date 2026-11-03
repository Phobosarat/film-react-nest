import { ConflictException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';

import { Film, FilmDocument } from '../films/schemas/film.schema';
import { FilmDto, ScheduleDto } from '../films/dto/films.dto';
import {
  CreateOrderDto,
  OrderedTicketDto,
  OrderResponseDto,
} from '../order/dto/order.dto';
import { FilmsRepository } from './films.repository';

@Injectable()
export class MongoFilmsRepository implements FilmsRepository {
  constructor(
    @InjectModel(Film.name)
    private readonly filmModel: Model<Film>,

    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async findAll(): Promise<FilmDto[]> {
    return this.filmModel.find().select('-_id -__v -schedule').lean().exec();
  }

  async findById(filmId: string): Promise<FilmDocument | null> {
    return this.filmModel.findOne({ id: filmId }).exec();
  }

  async findSchedule(filmId: string): Promise<ScheduleDto[]> {
    const film = await this.filmModel
      .findOne({ id: filmId })
      .select('schedule')
      .lean()
      .exec();

    if (!film) {
      return [];
    }

    return film.schedule.map((session) => ({
      ...session,
      hall: Number(session.hall),
    }));
  }

  private async reserveSeat(
    filmId: string,
    sessionId: string,
    seatKey: string,
    session: ClientSession,
  ): Promise<boolean> {
    const result = await this.filmModel.updateOne(
      {
        id: filmId,
        schedule: {
          $elemMatch: {
            id: sessionId,
            taken: { $ne: seatKey },
          },
        },
      },
      {
        $addToSet: {
          'schedule.$.taken': seatKey,
        },
      },
      { session },
    );

    return result.modifiedCount === 1;
  }

  async createOrder(order: CreateOrderDto): Promise<OrderResponseDto> {
    const session = await this.connection.startSession();

    try {
      const items = await session.withTransaction(
        async (): Promise<OrderedTicketDto[]> => {
          const bookedTickets: OrderedTicketDto[] = [];

          for (const ticket of order.tickets) {
            const seatKey = `${ticket.row}:${ticket.seat}`;

            const reserved = await this.reserveSeat(
              ticket.film,
              ticket.session,
              seatKey,
              session,
            );

            if (!reserved) {
              throw new ConflictException('Место уже занято');
            }

            bookedTickets.push({
              ...ticket,
              id: randomUUID(),
            });
          }

          return bookedTickets;
        },
      );

      if (!items) {
        throw new ConflictException('Не удалось завершить бронирование');
      }

      return {
        total: items.length,
        items,
      };
    } catch (error) {
      // Преобразуем конфликт записи MongoDB в HTTP 409.
      if (
        error instanceof Error &&
        (error.message.includes('WriteConflict') ||
          error.message.includes('write conflict') ||
          error.message.includes('TransientTransactionError'))
      ) {
        throw new ConflictException('Место уже занято или бронируется');
      }

      throw error;
    } finally {
      await session.endSession();
    }
  }
}
