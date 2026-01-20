const express = require('express');
const User = require('../models/User');

const router = express.Router();



const { getUserTotalCosts } = require('../services/cost_service_client');


// GET /users/api/users
// Gets list of all users from DB.
// Input: none
// Output: 200 + [ {id, first_name, last_name, birthday}, ... ]
// If DB fails: 500 + { error }

router.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, {
            _id: 0,          // do not return MongoDB _id
            id: 1,
            first_name: 1,
            last_name: 1,
            birthday: 1
        });

        res.json(users);
    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

// POST /users/api/add
// Adds new user to DB.
// Input (req.body): { id, first_name, last_name, birthday }
// Output:
//  - 201 + created user JSON
//  - 400/409 + { error } if validation fails / user already exists
router.post('/add', async (req, res) => {
    try {
        const { id, first_name, last_name, birthday } = req.body;


        if (id === undefined || !first_name || !last_name || !birthday) {
            res.locals.error = { id: 400, message: 'Missing required fields: id, first_name, last_name, birthday' };
            return res.status(400).json({
                error: res.locals.error.message
            });
        }
        // id must be a number
        const idNum = Number(id);
        if (Number.isNaN(idNum)) {
            res.locals.error = { id: 400, message: 'id must be a number' };
            return res.status(400).json({ error: res.locals.error.message });
        }
        // birthday must be a valid date
        const bday = new Date(birthday);
        if (Number.isNaN(bday.getTime())) {
            res.locals.error = { id: 400, message: 'birthday must be a valid date' };
            return res.status(400).json({ error: res.locals.error.message });
        }
        // create mongoose document
        const user = new User({
            id: idNum,
            first_name,
            last_name,
            birthday: bday
        });
        // check if user already exists
        const exists = await userExistsById(idNum);

        if (exists) {
            res.locals.error = { id: 409, message: 'User already exists' };
            return res.status(409).json({

                error: res.locals.error.message
            });
        }

        const savedUser = await user.save();


        return res.status(201).json({
            id: savedUser.id,
            first_name: savedUser.first_name,
            last_name: savedUser.last_name,
            birthday: savedUser.birthday
        });
    } catch (err) {

        if (err.code === 11000) {
            res.locals.error = { id: 409, message: 'User with this id already exists' };
            return res.status(409).json({ error: res.locals.error.message });
        }
        res.locals.error = { id: 400, message: err.message };
        return res.status(400).json({ error: res.locals.error.message });
    }
});

// GET /api/users/exists/:id
// Checks if user exists in DB by id.
// Input (req.params): id
// Output:
//  - 200 + { exists: true/false }
//  if id is not a number -> 400
//   if something breaks in server/db -> 500
router.get('/exists/:id', async (req, res) => {
    try {
        const idNum = Number(req.params.id);
        // id must be number
        if (Number.isNaN(idNum)) {
            return res.status(400).json({
                error: 'User id must be a number'
            });
        }


        const exists = await userExistsById(idNum);

        //  return JSON with boolean
        res.json({
            exists: !!exists
        });

    } catch (err) {
        res.locals.error = { id: 500, message: err.message };
        res.status(500).json({
            error: res.locals.error.message
        });
    }
});

// GET /users/api/:id
// Returns details for one user + total costs from Cost service.
// Input (req.params): id
// Output:
//  - 200 + { first_name, last_name, id, total }
//  - 400 + { error } if id not number
//  - 404 + { error } if user not found
//  - 500 + { error } if DB / cost-service fail
router.get('/:id', async (req, res) => {
    try {
        const idNum = Number(req.params.id);
        if (Number.isNaN(idNum)) {
            res.locals.error = { id: 400, message: 'User id must be a number' };
            return res.status(400).json({ error: res.locals.error.message });
        }

        const user = await User.findOne({ id: idNum }).lean();
        if (!user) {
            res.locals.error = { id: 404, message: 'User not found' };
            return res.status(404).json({ error: res.locals.error.message });
        }

        //  HTTP call to Cost service
        const total = await getUserTotalCosts(idNum);

        res.json({
            first_name: user.first_name,
            last_name: user.last_name,
            id: user.id,
            total
        });
    } catch (err){
        // error in DB or in remote call
        res.locals.error = { id: 500, message:  err.message };
        res.status(500).json({ error: res.locals.error.message });
    }
});
// userExistsById(userId)
// Helper function for checking if a user exists in DB.
// Input: userId (Number)
// Output: boolean (true/false)
const userExistsById = async (userId) => {
    const exists = await User.exists({ id: userId });
    return !!exists;
};

module.exports = router;
