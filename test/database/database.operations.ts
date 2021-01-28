import { data } from '../data/game.test.data';

export const N1QL = jest.fn(async (query: string) => {
  if (
    query ===
    `SELECT game_slug, game_name FROM default USE INDEX (Index_game using GSI) WHERE Meta().id LIKE '%::game'`
  ) {
    return data.slugGameQuery;
  } else if (
    query ===
    `SELECT *, Meta().id FROM default AS partners USE INDEX (Index_user using GSI) WHERE Meta().id LIKE '%::partner'`
  ) {
    return data.partnerData;
  }
  return [];
});

export const upsertObject = jest.fn(async (key: string, document: Object) => {
  return;
});

export const getObject = jest.fn(async (key: string) => {
  return { games: ['gameId1', 'gameId2'] };
});
