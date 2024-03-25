const pool = require("../config/dbconfig")
const FCM = require('fcm-node');

// const serverKey =
//     'AAAA0fzxGXs:APA91bGKjBCKzmVpNym82PC5_4iPYz65znBL1TJjFXFc7CJOFRYqMORwext356G7eavD9aH1uomJBx7vpTRaUTpDi6BPCo8YV00UjO8ZC3JYkv9KW9NWegDCNzMU7RrCc21eZGou5Y87';
// // 'AAAAkeCgr4A:APA91bF-MkjZGuGsAaHS1ES1pzPCqqKR5F6EuFtbRxVrPdzrodTtM0U9wbcpvwUpZIcL7gsgtQuupBCCID-kqQTO_GoIW2XJhoazanXDyVMAhk01IjIR9bvjDLm-2xI3hK5pBDS7bqdG';
// const fcm = new FCM(serverKey);

// const message = {
//     notification: {
//         title: 'Admin',
//         body: 'New Text By Admin'
//     },
//     to: 'cMgmfBa-RzOdrFZBHlMXZd:APA91bGMAI7FaxuJ923vW5oR1V55yl0XAsK8uzOjPTHce6OTcTx38ZQc6et0W18mihn6NClmAiktT_ztb-ATF9Md2bmHnH1HxKxMzcBsXx4IV3U-a_fZyVoq1DoAs0R-D8yA8yGxQ0Bd'
//     // 'fWKefWn0Rvu1F7p8nZ8bYX:APA91bGipE2vwNJdno00r7rlCpFtmWQptbrsewPBGbicP6NN9Q2J_AaqflrSnfRZzetPz1Hk1qDcmkcXxpYdPv65ZvVq4UNIXcf7tcaWRQSyQxUCi62zBnyu0pVzMqGCDm_6qJGxZ2Mm'
// };

// fcm.send(message, function (err, response) {
//     if (err) {
//         console.error('Error sending message', err);
//     } else {
//         console.log(
//             'Successfully sent message',
//             response,
//             message.notification
//         );
//     }
// });

const userExists = async (userId) => {
    const checkUserQuery = 'SELECT EXISTS (SELECT 1 FROM Users WHERE id = $1)';
    const result = await pool.query(checkUserQuery, [userId]);
    return result.rows[0].exists;
};

const sendnotification = async (req, res) => {
    try {
        const { sender_id, receiver_id, type, message } = req.body;

        // Check if both the sender and receiver users exist
        if (!(await userExists(sender_id))) {
            return res.status(404).json({ error: true, msg: 'Sender not found' });
        }

        if (!(await userExists(receiver_id))) {
            return res.status(404).json({ error: true, msg: 'Receiver not found' });
        }

        // Insert notification into the notifications table
        const insertNotificationQuery = `
            INSERT INTO notifications (sender_id, receiver_id, type, message)
            VALUES ($1, $2, $3, $4)
            RETURNING *;
        `;

        const notificationResult = await pool.query(insertNotificationQuery, [sender_id, receiver_id, type, message]);

        res.json({ error: false, msg: 'Notification sent successfully', data: notificationResult.rows[0] });
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ error: true, msg: 'Internal Server Error' });
    }
};

const serverKey = 'AAAA0fzxGXs:APA91bGKjBCKzmVpNym82PC5_4iPYz65znBL1TJjFXFc7CJOFRYqMORwext356G7eavD9aH1uomJBx7vpTRaUTpDi6BPCo8YV00UjO8ZC3JYkv9KW9NWegDCNzMU7RrCc21eZGou5Y87';
const fcm = new FCM(serverKey);

const sendAdminNotification = async (req, res) => {
    try {
        const { senderId, title, message } = req.body;

        // Fetch receiverIds with valid device IDs from the Users table
        const query = 'SELECT id, device_id FROM Users WHERE device_id IS NOT NULL';
        const result = await pool.query(query);
        const users = result.rows;

        console.log("receiverIds", users.map(user => user.id));
        // console.log("deviceIds", deviceIds);

        // Prepare notification payload
        const notification = {
            title: title,
            body: message
        };

        // Send push notifications and store notification details
        users.forEach(async user => {
            const { id: receiverId, device_id: deviceId } = user;

            const pushMessage = {
                to: deviceId,
                notification: notification
            };

            try {
                // Send push notification
                fcm.send(pushMessage, function (err, response) {
                    if (err) {
                        console.error('Error sending message', err);
                    } else {
                        console.log('Successfully sent message', response);

                        // Store notification details in the Notifications table
                        const insertQuery = `
                            INSERT INTO notifications (sender_id, receiver_id, type, message)
                            VALUES ($1, $2, $3, $4)
                        `;
                        pool.query(insertQuery, [senderId, receiverId, title, message])
                            .then(() => console.log('Notification details inserted successfully'))
                            .catch(error => console.error('Error inserting notification details', error));
                    }
                });
            } catch (err) {
                console.error('Error sending message', err);
            }
        });

        console.log(senderId, title, message);

        res.status(200).json({ error: false, msg: 'Notifications sent successfully.' });
    } catch (error) {
        console.error('Error sending notifications', error);
        res.status(500).json({ error: true, msg: 'Internal server error.' });
    }
};

const fetchNotificationsBySender = async (req, res) => {
    try {
        const { senderId } = req.params;

        // Fetch notifications for the given sender ID
        const query = `
            SELECT n.*, u.profile_image, u.age, u.block_status, u.name as receiver_name, u.email as receiver_email
            FROM notifications n
            JOIN users u ON n.receiver_id = u.id
            WHERE n.sender_id = $1
        `;
        const result = await pool.query(query, [senderId]);
        const notifications = result.rows;

        res.status(200).json({ error: false, data:notifications });
    } catch (error) {
        console.error('Error fetching notifications', error);
        res.status(500).json({ error: true, msg: 'Internal server error.' });
    }
};

const getUserNotifications = async (req, res) => {
    try {
        const { user_id } = req.params;
        let { page, limit } = req.query;
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const offset = (page - 1) * limit;

        // Check if the user exists
        if (!(await userExists(user_id))) {
            return res.status(404).json({ error: true, msg: 'User not found' });
        }

        // Fetch all notifications with sender and receiver details for the user
        const getNotificationsQuery = `
            SELECT
                n.id,
                n.sender_id,
                sender.name AS sender_name,
                sender.email AS sender_email,
                sender.images AS sender_images,
                sender.profile_image AS sender_profile_image,
                sender.gender AS sender_gender,
                sender.age AS sender_age,
                sender.role AS sender_role,
                n.receiver_id,
                receiver.name AS receiver_name,
                receiver.email AS receiver_email,
                receiver.images AS receiver_images,
                receiver.profile_image AS receiver_profile_image,
                receiver.gender AS receiver_gender,
                receiver.age AS receiver_age,
                receiver.role AS receiver_role,
                n.type,
                n.message,
                n.created_at
            FROM
                notifications n
                JOIN Users sender ON n.sender_id = sender.id
                JOIN Users receiver ON n.receiver_id = receiver.id
            WHERE
                n.receiver_id = $1
            ORDER BY
                n.created_at DESC
            LIMIT $2 OFFSET $3;
        `;

        const result = await pool.query(getNotificationsQuery, [user_id, limit, offset]);

        // Group notifications by sender
        const groupedNotifications = groupNotificationsBySender(result.rows);

        // Fetch total count of notifications for the user
        const countQuery = 'SELECT COUNT(*) FROM notifications WHERE receiver_id = $1';
        const countResult = await pool.query(countQuery, [user_id]);
        const totalCount = parseInt(countResult.rows[0].count, 10);

        res.json({
            error: false,
            msg: 'Notifications Fetched',
            count: totalCount,
            data: groupedNotifications,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: true, msg: 'Internal Server Error' });
    }
}

const getAllNotifications = async (req, res) => {
    try {
        // Fetch all notifications with sender and receiver details
        const getAllNotificationsQuery = `
            SELECT
                n.*,
                json_build_object(
                    'id', sender.id,
                    'images', sender.images,
                    'profile_image', sender.profile_image,
                    'name', sender.name,
                    'email', sender.email,
                    'device_id', sender.device_id,
                    'gender', sender.gender,
                    'age', sender.age,
                    'role', sender.role,
                    'block_status', sender.block_status,
                    'deleted_status', sender.deleted_status,
                    'deleted_at', sender.deleted_at,
                    'created_at', sender.created_at,
                    'updated_at', sender.updated_at,
                    'reported_status', sender.reported_status
                ) as sender,
                json_agg(
                    json_build_object(
                        'id', receiver.id,
                        'images', receiver.images,
                        'profile_image', receiver.profile_image,
                        'name', receiver.name,
                        'email', receiver.email,
                        'device_id', receiver.device_id,
                        'gender', receiver.gender,
                        'age', receiver.age,
                        'role', receiver.role,
                        'block_status', receiver.block_status,
                        'deleted_status', receiver.deleted_status,
                        'deleted_at', receiver.deleted_at,
                        'created_at', receiver.created_at,
                        'updated_at', receiver.updated_at,
                        'reported_status', receiver.reported_status
                    )
                ) as receivers
            FROM
                notifications n
            JOIN
                users sender ON n.sender_id = sender.id
            JOIN
                users receiver ON n.receiver_id = receiver.id
            GROUP BY
                n.id, sender.id
            ORDER BY
                n.id;
        `;

        const result = await pool.query(getAllNotificationsQuery);

        res.json({ error: false, msg: 'Notifications retrieved successfully', data: result.rows });
    } catch (error) {
        console.error('Error retrieving notifications:', error);
        res.status(500).json({ error: true, msg: 'Internal Server Error' });
    }
}

const groupNotificationsBySender = (notifications) => {
    const groupedNotifications = [];

    notifications.forEach((notification) => {
        // Check if the sender is already in the groupedNotifications array
        const existingSender = groupedNotifications.find((group) => group.sender.id === notification.sender_id);

        if (existingSender) {
            // If sender exists, add the receiver to the existing sender's receivers array
            existingSender.receivers.push({
                id: notification.receiver_id,
                name: notification.receiver_name,
                email: notification.receiver_email,
                images: notification.receiver_images,
                profile_image: notification.receiver_profile_image,
                gender: notification.receiver_gender,
                age: notification.receiver_age,
                role: notification.receiver_role
            });
        } else {
            // If sender doesn't exist, create a new group with sender and receiver
            const newGroup = {
                sender: {
                    id: notification.sender_id,
                    name: notification.sender_name,
                    email: notification.sender_email,
                    images: notification.sender_images,
                    profile_image: notification.sender_profile_image,
                    gender: notification.sender_gender,
                    age: notification.sender_age,
                    role: notification.sender_role
                },
                receivers: [
                    {
                        id: notification.receiver_id,
                        name: notification.receiver_name,
                        email: notification.receiver_email,
                        images: notification.receiver_images,
                        profile_image: notification.receiver_profile_image,
                        gender: notification.receiver_gender,
                        age: notification.receiver_age,
                        role: notification.receiver_role,
                    },
                ],
            };

            // Add the new group to the groupedNotifications array
            groupedNotifications.push(newGroup);
        }
    });

    return groupedNotifications;
};

module.exports = { sendnotification, sendAdminNotification, fetchNotificationsBySender, getUserNotifications, getAllNotifications };