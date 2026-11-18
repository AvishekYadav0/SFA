const cron = require('node-cron');
const Company = require('../models/Company');
const Subscription = require('../models/Subscription');
const { createAuditEntry } = require('./subscriptionService');

function buildWarningKey(subscriptionId, warningDays) {
  return `${subscriptionId}:${warningDays}`;
}

async function processSubscriptionNotifications() {
  const subscriptions = await Subscription.find({ status: { $in: ['active', 'past_due', 'pending'] } }).lean();

  for (const subscription of subscriptions) {
    const expiry = subscription.expiryDate ? new Date(subscription.expiryDate) : null;
    if (!expiry) continue;

    const now = new Date();
    const diffMs = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const warnings = [30, 15, 7, 3, 1];
    const keyMap = subscription.notificationState || {};

    for (const threshold of warnings) {
      if (diffDays <= threshold && diffDays > 0 && !keyMap[buildWarningKey(subscription._id.toString(), threshold)]) {
        await createAuditEntry({
          actorType: 'system',
          companyId: subscription.companyId,
          action: 'subscription_warning',
          module: 'subscription',
          description: `Subscription expires in ${threshold} day(s)`,
          previousValue: { status: subscription.status },
          newValue: { warningDays: threshold, expiresAt: expiry },
        });

        await Subscription.updateOne({ _id: subscription._id }, {
          $set: { [`notificationState.${buildWarningKey(subscription._id.toString(), threshold)}`]: now },
        });
      }
    }

    if (diffDays <= 0 && subscription.status !== 'expired') {
      await Subscription.updateOne({ _id: subscription._id }, { $set: { status: 'expired', expiryDate: expiry } });
      await createAuditEntry({
        actorType: 'system',
        companyId: subscription.companyId,
        action: 'subscription_expired',
        module: 'subscription',
        description: 'Subscription expired and company access is limited by platform licensing rules.',
        previousValue: { status: subscription.status },
        newValue: { status: 'expired', expiryDate: expiry },
      });
    }
  }
}

function startSubscriptionScheduler() {
  if (global.__subscriptionSchedulerStarted) return;
  global.__subscriptionSchedulerStarted = true;

  cron.schedule('*/5 * * * *', async () => {
    try {
      await processSubscriptionNotifications();
    } catch (error) {
      console.error('Subscription scheduler failed:', error.message);
    }
  });

  return { start: startSubscriptionScheduler };
}

module.exports = { startSubscriptionScheduler, processSubscriptionNotifications }; 
