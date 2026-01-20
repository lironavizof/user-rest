const express = require('express');
const User = require('../models/User');

const router = express.Router();




const { getUserTotalCosts } = require('../services/cost_service_client');



//GET /api/users
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

router.post('/add', async (req, res) => {
    try {
        const { id, first_name, last_name, birthday } = req.body;


        if (id === undefined || !first_name || !last_name || !birthday) {
            res.locals.error = { id: 400, message: 'Missing required fields: id, first_name, last_name, birthday' };
            return res.status(400).json({
                error: res.locals.error.message
            });
        }

        const idNum = Number(id);
        if (Number.isNaN(idNum)) {
            res.locals.error = { id: 400, message: 'id must be a number' };
            return res.status(400).json({ error: res.locals.error.message });
        }


        const bday = new Date(birthday);
        if (Number.isNaN(bday.getTime())) {
            res.locals.error = { id: 400, message: 'birthday must be a valid date' };
            return res.status(400).json({ error: res.locals.error.message });
        }


        const user = new User({
            id: idNum,
            first_name,
            last_name,
            birthday: bday
        });

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
router.get('/exists/:id', async (req, res) => {
    try {
        const idNum = Number(req.params.id);

        if (Number.isNaN(idNum)) {
            return res.status(400).json({
                error: 'User id must be a number'
            });
        }

        //const exists = await User.exists({ id: idNum });
        const exists = await userExistsById(idNum);

        // ✅ return JSON with boolean
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
    } catch (err) {
        res.locals.error = { id: 500, message:  err.message };
        res.status(500).json({ error: res.locals.error.message });
    }
});


const userExistsById = async (userId) => {
    const exists = await User.exists({ id: userId });
    return !!exists;
};

module.exports = router;
