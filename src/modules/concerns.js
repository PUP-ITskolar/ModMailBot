const blocked = require("../data/blocked");
const threads = require("../data/threads");
const utils = require("../utils");

const COMMAND_NAME = "concerns";
const OFFICER_BUTTON = "modmail:concern:officer";
const MODERATION_BUTTON = "modmail:concern:moderation";
const STAFF_CLOSE_BUTTON = "modmail:concern:staff-close";
const STAFF_MOVE_BUTTON = "modmail:concern:staff-move";
const MANAGE_GUILD = 1 << 5;

const concernPanel = {
  embeds: [{
    title: "Concerns",
    description: "Any concerns regarding the management of this class should be sent here. This is a way to raise concerns in a proper way.",
    fields: [
      { name: "Officer Concern", value: "Concerns regarding how the class is managed." },
      { name: "Moderation Concern", value: "Concerns regarding how this Discord server is managed." },
    ],
  }],
  components: [{
    type: 1,
    components: [
      { type: 2, style: 1, custom_id: OFFICER_BUTTON, label: "Officer Concerns" },
      { type: 2, style: 2, custom_id: MODERATION_BUTTON, label: "Moderation Concerns" },
    ],
  }],
};

const staffPanel = {
  embeds: [{
    title: "Modmail quick guide",
    description: "Talk normally in this thread to reply to the user. Messages prefixed with `!` are staff-only commands and are not sent to the user.",
  }],
  components: [{
    type: 1,
    components: [
      { type: 2, style: 4, custom_id: STAFF_CLOSE_BUTTON, label: "Close" },
      { type: 2, style: 1, custom_id: STAFF_MOVE_BUTTON, label: "Move" },
    ],
  }],
};

const postStaffPanel = thread => thread.postNonLogMessage(staffPanel);

module.exports = ({ bot, config }) => {
  const concernRouting = config.concernRouting;
  if (! concernRouting || ! concernRouting.officerCategoryId || ! concernRouting.moderationCategoryId) return;

  const guildIds = new Set(config.mainServerId);
  const openingUserIds = new Set();

  Promise.all(Array.from(guildIds, async guildId => {
    const commands = await bot.getGuildCommands(guildId);
    if (! commands.some(command => command.name === COMMAND_NAME)) {
      await bot.createGuildCommand(guildId, {
        name: COMMAND_NAME,
        description: "Post the concerns panel",
        defaultMemberPermissions: MANAGE_GUILD,
      });
    }
  })).catch(err => console.error(`Could not register /${COMMAND_NAME}: ${err.message}`));

  bot.on("interactionCreate", async interaction => {
    if (interaction.data.name === COMMAND_NAME && guildIds.has(interaction.guildID)) {
      await interaction.createMessage(concernPanel);
      return;
    }

    if (interaction.data.custom_id === STAFF_CLOSE_BUTTON || interaction.data.custom_id === STAFF_MOVE_BUTTON) {
      if (! interaction.member || ! utils.isStaff(interaction.member)) {
        return interaction.createMessage({ content: "Only staff can use these ticket actions.", flags: 64 });
      }

      const thread = await threads.findOpenThreadByChannelId(interaction.channel.id);
      if (! thread) return interaction.createMessage({ content: "This ticket is no longer open.", flags: 64 });

      if (interaction.data.custom_id === STAFF_CLOSE_BUTTON) {
        await interaction.createMessage({ content: "Closing ticket...", flags: 64 });
        try {
          await bot.closeThreadByStaff(thread, interaction.member.user);
        } catch (err) {
          await interaction.editOriginalMessage({ content: `Could not close the ticket: ${err.message}` });
        }
        return;
      }

      await interaction.defer(64);
      try {
        if (! bot.moveConcernThread) return interaction.editOriginalMessage({ content: "Moving tickets is disabled." });
        const category = await bot.moveConcernThread(thread);
        return interaction.editOriginalMessage({ content: `Ticket moved to ${category.name}.` });
      } catch (err) {
        return interaction.editOriginalMessage({ content: `Action failed: ${err.message}` });
      }
    }

    const route = interaction.data.custom_id === OFFICER_BUTTON
      ? { categoryId: concernRouting.officerCategoryId, mentionRole: concernRouting.officerMentionRole, label: "officer" }
      : interaction.data.custom_id === MODERATION_BUTTON
        ? { categoryId: concernRouting.moderationCategoryId, mentionRole: concernRouting.moderationMentionRole, label: "moderation" }
        : null;
    if (! route || ! guildIds.has(interaction.guildID)) return;

    await interaction.defer(64);
    const user = interaction.member && interaction.member.user;
    if (! user) return interaction.editOriginalMessage({ content: "I couldn't identify your Discord account." });
    if (openingUserIds.has(user.id)) return interaction.editOriginalMessage({ content: "Your concern ticket is already being opened." });
    if (await blocked.isBlocked(user.id)) return interaction.editOriginalMessage({ content: "You can't open a concern ticket." });

    const existingThread = await threads.findOpenThreadByUserId(user.id);
    if (existingThread) return interaction.editOriginalMessage({ content: `You already have an open ticket: <#${existingThread.channel_id}>` });

    openingUserIds.add(user.id);
    try {
      try {
        const dm = await user.getDMChannel();
        await dm.createMessage("Your concern ticket is being opened. Please reply here with the details of your concern.");
      } catch {
        return interaction.editOriginalMessage({ content: "I couldn't send you a DM. Please enable DMs from server members and try again." });
      }

      const thread = await threads.createNewThreadForUser(user, { ...route, source: "concern-panel" });
      if (! thread) return interaction.editOriginalMessage({ content: "I couldn't open your concern ticket. Please try again later." });

      await thread.postSystemMessage(`This thread was opened from the ${route.label} concern panel.`);
      await postStaffPanel(thread);
      await interaction.editOriginalMessage({ content: "Your concern ticket is open. Please continue in the DM I sent you." });
    } finally {
      openingUserIds.delete(user.id);
    }
  });
};

module.exports.postStaffPanel = postStaffPanel;
