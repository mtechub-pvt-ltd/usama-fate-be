const { contains } = require("validator");
const pool = require("../config/dbconfig") 

// const disqualifyuser = async (req, res) => {
//     const { user_id, disqualify_user_id, reason } = req.body;

//     try {
//         // Check if both user_id and disqualify_user_id exist in the Users table
//         const usersExistQuery = 'SELECT * FROM Users WHERE id IN ($1)';
//         const usersExistResult = await pool.query(usersExistQuery, [user_id]);

//         if (usersExistResult.rows.length === 0) {
//             // If one or both users do not exist, return an error response
//             return res.status(400).json({ error: true, msg: 'User not found.' });
//         }

//         const disqualifyUsersExist = await pool.query('SELECT * FROM Users WHERE id IN ($1)', [disqualify_user_id]);

//         if (disqualifyUsersExist.rows.length === 0) {
//             // If one or both users do not exist, return an error response
//             return res.status(400).json({ error: true, msg: 'User whom will be disqualified not found.' });
//         }

//         // Check if a disqualification record already exists for the given pair of users
//         const existingDisqualificationQuery = 'SELECT * FROM disqualify_user WHERE user_id = $1 AND disqualify_user_id = $2';
//         const existingDisqualificationResult = await pool.query(existingDisqualificationQuery, [user_id, disqualify_user_id]);

//         if (existingDisqualificationResult.rows.length > 0) {
//             // If a disqualification record already exists, return an error response
//             return res.status(400).json({ error: true, msg: 'User is already disqualified by the this user.' });
//         }

//         // Insert a new disqualification record into the database
//         const disqualifyResult = await pool.query(
//             'INSERT INTO disqualify_user (user_id, disqualify_user_id, reason) VALUES ($1, $2, $3) RETURNING *',
//             [user_id, disqualify_user_id, reason]
//         );

//         // Update disqualify_status to true for both users in the Users table
//         const updateUsersQuery = 'UPDATE Users SET disqualify_status = true WHERE id IN ($1)';
//         await pool.query(updateUsersQuery, [disqualify_user_id]);

//         // Respond with the newly created disqualification record
//         res.status(201).json({ msg: "User disqualified successfully", error: false, data: disqualifyResult.rows[0] });
//     } catch (error) {
//         console.error('Error disqualifying user:', error);
//         res.status(500).send({ error: true, msg: 'Internal Server Error' });
//     }
// };

const disqualifyuser = async (req, res) => {
    const { user_id, disqualify_user_id, reason } = req.body;

    try {
        // Check if both user_id and disqualify_user_id exist in the Users table
        const usersExistQuery = 'SELECT * FROM Users WHERE id IN ($1)';
        const usersExistResult = await pool.query(usersExistQuery, [user_id]);

        if (usersExistResult.rows.length === 0) {
            return res.status(400).json({ error: true, msg: 'User not found.' });
        }

        // Check if the user is not disqualifying more than 5 times a day
        const disqualificationCountQuery = `
            SELECT COUNT(*) AS disqualification_count
            FROM disqualify_user 
            WHERE user_id = $1 AND created_at >= CURRENT_DATE`;
        const disqualificationCountResult = await pool.query(disqualificationCountQuery, [user_id]);

        if (disqualificationCountResult.rows[0].disqualification_count >= 5) {
            return res.status(400).json({ error: true, msg: 'You have reached the daily disqualification limit.' });
        }

        // Update disqualify_status to true for the disqualified user in the Users table
        await pool.query('UPDATE Users SET disqualify_status = true WHERE id = $1', [disqualify_user_id]);

        // Update alo_level for the disqualified user
        await pool.query('UPDATE Users SET alo_level = alo_level - 1 WHERE id = $1', [disqualify_user_id]);

        // Insert a new disqualification record into the database
        const disqualifyResult = await pool.query(
            'INSERT INTO disqualify_user (user_id, disqualify_user_id, reason) VALUES ($1, $2, $3) RETURNING *',
            [user_id, disqualify_user_id, reason]
        );

        // Respond with the newly created disqualification record
        res.status(201).json({ msg: "User disqualified successfully", error: false, data: disqualifyResult.rows[0] });
    } catch (error) {
        console.error('Error disqualifying user:', error);
        res.status(500).send({ error: true, msg: 'Internal Server Error' });
    }
};

const getDisqualifyUserList = async (req, res) => {
    try {
        let { page, limit } = req.query;
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const offset = (page - 1) * limit;

        const query = `
            SELECT
                u.id AS user_id,
                u.name AS user_name,
                u.email AS user_email,
                u.images AS user_images,
                u.profile_image AS user_profile_image,
                u.gender AS user_gender,
                u.age AS user_age,
                u.role AS user_role,
                u.block_status AS user_block_status,
                u.deleted_status AS user_deleted_status,
                u.deleted_at AS user_deleted_at,
                u.created_at AS user_created_at,
                u.updated_at AS user_updated_at,
                d.id AS disqualification_id,
                d.disqualify_user_id,
                d.reason AS disqualification_reason,
                d.created_at AS disqualification_created_at,
                d.updated_at AS disqualification_updated_at,
                du.name AS disqualify_user_name,
                du.email AS disqualify_user_email,
                du.images AS disqualify_user_images,
                du.profile_image AS disqualify_user_profile_image,
                du.gender AS disqualify_user_gender,
                du.age AS disqualify_user_age,
                du.role AS disqualify_user_role,
                du.block_status AS disqualify_user_block_status,
                du.deleted_status AS disqualify_user_deleted_status,
                du.deleted_at AS disqualify_user_deleted_at,
                du.created_at AS disqualify_user_created_at,
                du.updated_at AS disqualify_user_updated_at
            FROM
                Users u
            JOIN
                disqualify_user d ON u.id = d.user_id
            JOIN
                Users du ON du.id = d.disqualify_user_id
            ORDER BY u.id
            LIMIT $1 OFFSET $2;
        `;

        const result = await pool.query(query, [limit, offset]);

        // Grouping the results by user_id
        const groupedResults = {};
        result.rows.forEach((row) => {
            const {
                user_id,
                user_name,
                user_email,
                user_images,
                user_profile_image,
                user_gender,
                user_age,
                user_role,
                user_block_status,
                user_deleted_status,
                user_deleted_at,
                user_created_at,
                user_updated_at,
                disqualification_id,
                disqualify_user_id,

                disqualify_user_name,
                disqualify_user_email,
                disqualify_user_images,
                disqualify_user_profile_image,
                disqualify_user_gender,
                disqualify_user_age,
                disqualify_user_role,
                disqualify_user_block_status,
                disqualify_user_deleted_status,

                disqualification_reason,
                disqualification_created_at,
                disqualification_updated_at,
            } = row;

            if (!groupedResults[user_id]) {
                groupedResults[user_id] = {
                    user_id,
                    user_name,
                    user_email,
                    user_images,
                    user_profile_image,
                    user_gender,
                    user_age,
                    user_role,
                    user_block_status,
                    user_deleted_status,
                    user_deleted_at,
                    user_created_at,
                    user_updated_at,
                    disqualifications: [],
                };
            }

            groupedResults[user_id].disqualifications.push({
                disqualification_id,
                disqualify_user_id,
                disqualify_user_name,
                disqualify_user_email,
                disqualify_user_images,
                disqualify_user_profile_image,
                disqualify_user_gender,
                disqualify_user_age,
                disqualify_user_role,
                disqualify_user_block_status,
                disqualify_user_deleted_status,
                disqualification_reason,
                disqualification_created_at,
                disqualification_updated_at,
            });
        });

        // Transforming the grouped results into an array
        const groupedArray = Object.values(groupedResults);

        res.status(200).json({
            error: false,
            // count: groupedArray.length,
            data: groupedArray,
        });
    } catch (error) {
        console.error('Error fetching users and disqualifications:', error);
        res.status(500).json({ error: true, msg: 'Internal Server Error' });
    }
}

const getUsersDisqualification = async (req, res) => {
    try {
        let { page, limit } = req.query;
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;
        const offset = (page - 1) * limit;

        const userId = req.params.user_id; // Get user_id from request parameters

        const query = `
            SELECT
                u.id AS user_id,
                u.name AS user_name,
                u.email AS user_email,
                u.images AS user_images,
                u.profile_image AS user_profile_image,
                u.gender AS user_gender,
                u.age AS user_age,
                u.role AS user_role,
                u.block_status AS user_block_status,
                u.deleted_status AS user_deleted_status,
                u.deleted_at AS user_deleted_at,
                u.created_at AS user_created_at,
                u.updated_at AS user_updated_at,
                d.id AS disqualification_id,
                d.disqualify_user_id,
                d.reason AS disqualification_reason,
                d.created_at AS disqualification_created_at,
                d.updated_at AS disqualification_updated_at,
                du.name AS disqualify_user_name,
                du.email AS disqualify_user_email,
                du.images AS disqualify_user_images,
                du.profile_image AS disqualify_user_profile_image,
                du.gender AS disqualify_user_gender,
                du.age AS disqualify_user_age,
                du.role AS disqualify_user_role,
                du.block_status AS disqualify_user_block_status,
                du.deleted_status AS disqualify_user_deleted_status,
                du.deleted_at AS disqualify_user_deleted_at,
                du.created_at AS disqualify_user_created_at,
                du.updated_at AS disqualify_user_updated_at
            FROM
                Users u
            JOIN
                disqualify_user d ON u.id = d.user_id
            JOIN
                Users du ON du.id = d.disqualify_user_id
            WHERE
                u.id = $1
            ORDER BY u.id
            LIMIT $2 OFFSET $3;
        `;

        const result = await pool.query(query, [userId, limit, offset]);

        // Grouping the results by user_id
        const groupedResults = {};
        result.rows.forEach((row) => {
            const {
                user_id,
                user_name,
                user_email,
                user_images,
                user_profile_image,
                user_gender,
                user_age,
                user_role,
                user_block_status,
                user_deleted_status,
                user_deleted_at,
                user_created_at,
                user_updated_at,
                disqualification_id,
                disqualify_user_id,

                disqualify_user_name,
                disqualify_user_email,
                disqualify_user_images,
                disqualify_user_profile_image,
                disqualify_user_gender,
                disqualify_user_age,
                disqualify_user_role,
                disqualify_user_block_status,
                disqualify_user_deleted_status,

                disqualification_reason,
                disqualification_created_at,
                disqualification_updated_at,
            } = row;

            if (!groupedResults[user_id]) {
                groupedResults[user_id] = {
                    user_id,
                    user_name,
                    user_email,
                    user_images,
                    user_profile_image,
                    user_gender,
                    user_age,
                    user_role,
                    user_block_status,
                    user_deleted_status,
                    user_deleted_at,
                    user_created_at,
                    user_updated_at,
                    disqualifications: [],
                };
            }

            groupedResults[user_id].disqualifications.push({
                disqualification_id,
                disqualify_user_id,
                disqualify_user_name,
                disqualify_user_email,
                disqualify_user_images,
                disqualify_user_profile_image,
                disqualify_user_gender,
                disqualify_user_age,
                disqualify_user_role,
                disqualify_user_block_status,
                disqualify_user_deleted_status,
                disqualification_reason,
                disqualification_created_at,
                disqualification_updated_at,
            });
        });

        // Transforming the grouped results into an array
        const groupedArray = Object.values(groupedResults);

        const totalDisqualifications = groupedArray.length > 0 ? groupedArray[0].disqualifications.length : 0;

        // console.log("totalDisqualifications",  totalDisqualifications);

        res.status(200).json({
            error: false,
            count: totalDisqualifications,
            data: groupedArray,
        });
    } catch (error) {
        console.error('Error fetching disqualified users for a specific user:', error);
        res.status(500).json({ error: true, msg: 'Internal Server Error' });
    }

}

const updatedisqualificationreason = async (req, res) => {
    const { disqualification_id, reason } = req.body;

    try {
        // Check if the disqualification record exists
        const existingDisqualificationQuery = 'SELECT * FROM disqualify_user WHERE id = $1';
        const existingDisqualificationResult = await pool.query(existingDisqualificationQuery, [disqualification_id]);

        if (existingDisqualificationResult.rows.length === 0) {
            // If the disqualification record does not exist, return an error response
            return res.status(400).json({ error: true, msg: 'Disqualification record not found.' });
        }

        // Update the disqualification reason in the database
        const updateDisqualificationQuery = 'UPDATE disqualify_user SET reason = $1 WHERE id = $2 RETURNING *';
        const updatedDisqualificationResult = await pool.query(updateDisqualificationQuery, [reason, disqualification_id]);

        // Respond with the updated disqualification record
        res.status(200).json({ msg: 'Disqualification reason updated successfully', error: false, data: updatedDisqualificationResult.rows[0] });
    } catch (error) {
        console.error('Error updating disqualification reason:', error);
        res.status(500).json({ error: true, msg: 'Internal Server Error' });
    }
}

const deleteDisqualification = async (req, res) => {
    const { id } = req.params;

    try {
        // Check if the disqualification record exists
        const existingDisqualificationQuery = 'SELECT * FROM disqualify_user WHERE id = $1';
        const existingDisqualificationResult = await pool.query(existingDisqualificationQuery, [id]);

        if (existingDisqualificationResult.rows.length === 0) {
            // If the disqualification record does not exist, return an error response
            return res.status(400).json({ error: true, msg: 'Disqualification record not found.' });
        }

        // Get the disqualified_user_id from the disqualification record
        const disqualifiedUserId = existingDisqualificationResult.rows[0].disqualify_user_id;

        // Delete the disqualification record from the database
        const deleteDisqualificationQuery = 'DELETE FROM disqualify_user WHERE id = $1 RETURNING *';
        const deletedDisqualificationResult = await pool.query(deleteDisqualificationQuery, [id]);

        // Update  disqualify_status to false for the disqualified_user_id in the Users table
        const updateDisqualifiedStatusQuery = 'UPDATE Users SET  disqualify_status = false WHERE id = $1';
        await pool.query(updateDisqualifiedStatusQuery, [disqualifiedUserId]);

        // Respond with the deleted disqualification record
        res.status(200).json({ msg: 'Disqualification record deleted successfully', error: false, data: deletedDisqualificationResult.rows[0] });
    } catch (error) {
        console.error('Error deleting disqualification record:', error);
        res.status(500).json({ error: true, msg: 'Internal Server Error' });
    }
};

const disqualifiedusers = async (req, res) => {
    try {
        // Check if it's been more than 7 days since the last update
        const lastUpdateQuery = 'SELECT MAX(updated_at) as last_update FROM disqualify_user;';
        const lastUpdateResult = await pool.query(lastUpdateQuery);
        const lastUpdateTimestamp = lastUpdateResult.rows[0].last_update;

        const now = new Date();
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

        if (!lastUpdateTimestamp || new Date(lastUpdateTimestamp) < sevenDaysAgo) {
            // If it's been more than 7 days or no previous update, update the data
            const updateDataQuery = 'UPDATE disqualify_user SET updated_at = NOW();';
            await pool.query(updateDataQuery);
        }

        const fetchDataQuery = `
        SELECT
          disqualify_user_id,
          COUNT(disqualify_user_id) as disqualify_count, 
          (ARRAY_AGG(reason ORDER BY RANDOM() * 0))[1] as random_max_reason,
          STRING_AGG(user_id::TEXT, ',') as disqualifying_users
        FROM
          disqualify_user
        WHERE
          disqualify_user_id IN (
            SELECT disqualify_user_id
            FROM disqualify_user
            WHERE updated_at >= $1
            GROUP BY disqualify_user_id
            HAVING COUNT(disqualify_user_id) > 1
          )
        GROUP BY
          disqualify_user_id
        ORDER BY
          disqualify_count DESC;
      `;

        const fetchDataResult = await pool.query(fetchDataQuery, [sevenDaysAgo]);
        const disqualifyUsers = fetchDataResult.rows;

        // Transforming the result structure
        const transformedData = disqualifyUsers.map(user => ({
            disqualify_count: user.disqualify_count,
            random_max_reason: user.random_max_reason,
            disqualify: {
                disqualify_user_id: user.disqualify_user_id,
                // Add other relevant user details as needed
            },
            disqualified_by: user.disqualifying_users.split(',').map(userId => ({
                user_id: userId,
                // Add other relevant user details as needed
            })),
        }));

        res.json(transformedData);
    } catch (error) {
        console.error('Error fetching disqualify users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}

module.exports = { disqualifyuser, getDisqualifyUserList, getUsersDisqualification, updatedisqualificationreason, deleteDisqualification, disqualifiedusers };