import { Test, TestingModule } from '@nestjs/testing';
import { GamesService } from '../../src/games/games.service';
import { data, GameMapper as Mapper } from '../data/game.test.data';
import { BadRequestException } from '@nestjs/common';
import { GameMapper } from '../../src/games/mapper/game.mapper';
import { getObject, N1QL, upsertObject } from '../database/database.operations';
import { PartnerObject } from '../../src/games/interface/partner.object.interface';
import { GameResponseDto } from '../../src/games/dto/game.response.dto';

describe('GamesService', () => {
  let service: GamesService;
  let mapper: GameMapper;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GamesService, GameMapper],
    }).compile();

    service = module.get<GamesService>(GamesService);
    mapper = module.get<GameMapper>(GameMapper);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', async () => {
    let requestDto = data.requestDto;
    it('all games slug', async () => {
      const allGamesSlugArray = data.slugGameQuery;
      const allGamesSlugQuery = `SELECT game_slug, game_name FROM default USE INDEX (Index_game using GSI) WHERE Meta().id LIKE '%::game'`;
      const allGamesSlug = (await N1QL(allGamesSlugQuery)) as [
        { game_name: string; game_slug: string },
      ];
      //to check if data is same
      expect(allGamesSlug).toBe(allGamesSlugArray);
      const mockSlug = jest.fn(o => {
        try {
          if (o.game_slug === requestDto.slug) throw new Error();
          try {
            if (o.game_name.toLowerCase() === requestDto.name.toLowerCase())
              throw new Error();
          } catch (e) {
            expect(e).toBeInstanceOf(BadRequestException);
            expect(e.message).toBe(
              'Game name already exists, Please use another name',
            );
          }
        } catch (ex) {
          expect(ex).toBeInstanceOf(BadRequestException);
          expect(ex.message).toBe(
            'Game slug already exists, Please use another slug',
          );
        }
      });
      //mock function for all games slug validation
      allGamesSlugArray.forEach(o => mockSlug(o));
    });
    const game = Mapper(requestDto);
    const gameId = '5e9a3239-8431-4238-ab8e-592cf36d0e02';
    game['id'] = gameId;
    game['created'] = 1609327253964;
    //game mapping test
    it('map game', () => {
      expect(mapper).toBeDefined();
      expect(game).toEqual(data.mappedGame);
    });

    const partnerQuery = `SELECT *, Meta().id FROM default AS partners USE INDEX (Index_user using GSI) WHERE Meta().id LIKE '%::partner'`;
    const partners = (await N1QL(partnerQuery)) as [
      { id: string; partners: PartnerObject },
    ];
    const partnersMock = jest.fn(o => {
      if (o.partners.name === requestDto.producer) {
        return o;
      }
    });
    const gamePartners = partners.find(o => partnersMock(o));
    gamePartners.partners.game_count += 1;

    const saveGame = await upsertObject(`${gameId}::game`, game);

    //to ensure game data is saved in db
    expect(saveGame).toHaveBeenCalled();

    const savePartners = await upsertObject(
      `${gamePartners.id}`,
      gamePartners.partners,
    );

    //to ensure partner data is updated in db
    expect(savePartners).toHaveBeenCalled();

    it('add active games in all games list', async () => {
      expect(game.game_status).toEqual('ACTIVE');
      const allGames = await getObject('all_games');
      expect(allGames).toBe({ games: ['gameId1', 'gameId2'] });
      allGames.games.push(gameId);
      const saveActiveGames = await upsertObject('all_games', allGames);
      expect(saveActiveGames).toHaveBeenCalled();
    });
    const response = data.gameResponse;
    expect(response).toBeInstanceOf(GameResponseDto);
  });
});
