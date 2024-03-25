const express = require('express');
const router = express.Router();
const notificationsController = require("../../controllers/notificationsController");

router.post('/v1/sendnotification', notificationsController.sendnotification);
router.post('/v1/notificationByAdmin', notificationsController.sendAdminNotification);
router.get('/v1/notificationsBySender/:senderId', notificationsController.fetchNotificationsBySender);
router.get('/v1/getUserNotifications/:user_id', notificationsController.getUserNotifications);
router.get('/v1/getAllNotifications', notificationsController.getAllNotifications);

module.exports = router;