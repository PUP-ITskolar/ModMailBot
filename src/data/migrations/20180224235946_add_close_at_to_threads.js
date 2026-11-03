exports.up = async function (knex, Promise) {
  await knex.schema.table("threads", table => {
    table.dateTime("scheduled_close_at").index().nullable().defaultTo(null);
    table.string("scheduled_close_id", 20).nullable().defaultTo(null);
    table.string("scheduled_close_name", 128).nullable().defaultTo(null);
  });
};

exports.down = async function(knex, Promise) {
  await knex.schema.table("threads", table => {
    table.dropColumn("scheduled_close_at");
    table.dropColumn("scheduled_close_id");
    table.dropColumn("scheduled_close_name");
  });
};
