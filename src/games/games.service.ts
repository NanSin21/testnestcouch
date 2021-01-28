import { BadRequestException, Injectable } from '@nestjs/common';
import { GameRequestDto } from './dto/game.request.dto';
import { GameResponseDto } from './dto/game.response.dto';
import * as uuid from 'uuid';
import { GameMapper } from './mapper/game.mapper';
import { PartnerObject } from './interface/partner.object.interface';
import { GameStatuses } from '../config/constants';
import {
  getObject,
  N1QL,
  upsertObject,
} from '../../test/database/database.operations';

@Injectable()
export class GamesService {
  constructor(private readonly gameMapper: GameMapper) {}

  async create(requestDto: GameRequestDto): Promise<GameResponseDto> {
    const allGamesSlugQuery = `SELECT game_slug, game_name FROM default USE INDEX (Index_game using GSI) WHERE Meta().id LIKE '%::game'`;
    const allGamesSlug = (await N1QL(allGamesSlugQuery)) as [
      { game_name: string; game_slug: string },
    ];
    allGamesSlug.forEach(o => {
      if (o.game_name.toLowerCase() === requestDto.name.toLowerCase()) {
        throw new BadRequestException(
          'Game name already exists, Please use another name',
        );
      }
      if (o.game_slug === requestDto.slug) {
        throw new BadRequestException(
          'Game slug already exists, Please use another slug',
        );
      }
    });
    const game = this.gameMapper.mapGameData(requestDto);
    const gameId = uuid.v4();
    game['id'] = gameId;
    game['created'] = Date.now();
    const partnerQuery = `SELECT *, Meta().id FROM default AS partners USE INDEX (Index_user using GSI) WHERE Meta().id LIKE '%::partner'`;
    const partners = (await N1QL(partnerQuery)) as [
      { id: string; partners: PartnerObject },
    ];
    const gamePartners = partners.find(o => {
      if (o.partners.name === requestDto.producer) {
        return o;
      }
    });
    gamePartners.partners.game_count += 1;
    Promise.all([
      await upsertObject(`${gameId}::game`, game),
      await upsertObject(`${gamePartners.id}`, gamePartners.partners),
    ]);
    // add gameId to all_games if game is active
    if (game.game_status === GameStatuses.ACTIVE) {
      const allGames = (await getObject('all_games')) as { games: string[] };
      allGames.games.push(gameId);
      await upsertObject('all_games', allGames);
    }
    return new GameResponseDto(game);
  }
}
