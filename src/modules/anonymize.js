const crypto = require("crypto");
const fs = require("fs");
const knex = require("../knex");
const threads = require("../data/threads");
const { THREAD_MESSAGE_TYPE, THREAD_STATUS } = require("../data/constants");

async function anonymizeThread(thread) {
  const userId = thread.user_id;
  const anonymizedUserId = crypto.randomBytes(10).toString("hex");
  const oldLogPath = thread.log_storage_data && thread.log_storage_data.fullPath;

  if (oldLogPath && fs.existsSync(oldLogPath)) {
    try {
      fs.unlinkSync(oldLogPath);
    } catch (err) {
      return false;
    }
  }

  await knex.transaction(async trx => {
    await trx("notes").where("user_id", userId).delete();
    await trx("blocked_users").where("user_id", userId).delete();
    await trx("thread_messages")
      .where("thread_id", thread.id)
      .update({ dm_channel_id: null, dm_message_id: null });
    await trx("thread_messages")
      .where("thread_id", thread.id)
      .where("message_type", THREAD_MESSAGE_TYPE.FROM_USER)
      .update({ user_id: null, user_name: "Anonymous user" });
    await trx("thread_messages")
      .where("thread_id", thread.id)
      .where("message_type", THREAD_MESSAGE_TYPE.SYSTEM)
      .delete();
    await trx("threads")
      .where("id", thread.id)
      .update({ user_id: anonymizedUserId, user_name: "Anonymous user" });
  });

  await knex("threads")
    .where("id", thread.id)
    .update({ log_storage_type: null, log_storage_data: null });

  return true;
}

module.exports = ({ config, commands, hooks }) => {
  hooks.afterThreadClose(async ({ threadId }) => {
    try {
      const thread = await threads.findById(threadId);
      if (thread && await anonymizeThread(thread)) return;
    } catch (err) {
      console.error(`Failed to anonymize closed thread ${threadId}: ${err.message}`);
      return;
    }

    console.error(`Failed to anonymize closed thread ${threadId}`);
  });

  commands.addInboxServerCommand("anonymize", "<threadId:string> [confirm:string]", async (msg, args) => {
    const thread = (await threads.findById(args.threadId)) || (await threads.findByThreadNumber(args.threadId));
    if (! thread) {
      await msg.channel.createMessage("Thread not found.");
      return;
    }

    if (thread.status !== THREAD_STATUS.CLOSED) {
      await msg.channel.createMessage("Only closed threads can be anonymized.");
      return;
    }

    if (args.confirm !== "confirm") {
      await msg.channel.createMessage(`This permanently removes the user identity, notes, and block state for thread #${thread.thread_number}. Run \`${config.prefix}anonymize ${thread.thread_number} confirm\` to continue.`);
      return;
    }

    if (! await anonymizeThread(thread)) {
      await msg.channel.createMessage("Could not delete the existing log file; the thread was not anonymized.");
      return;
    }

    await msg.channel.createMessage(`Thread #${thread.thread_number} has been anonymized.`);
  });
};
