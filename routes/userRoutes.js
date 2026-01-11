const express = require('express');
const User = require('../models/User');
//const Cost = require('../models/Cost');

const router = express.Router();


// router.get('/:id', async (req, res) => {
//     try {
//         const idNum = Number(req.params.id);
//         if (Number.isNaN(idNum)) {
//             return res.status(400).json({ error: 'User id must be a number' });
//         }
//
//         const user = await User.findOne({ id: idNum }).lean();
//         if (!user) {
//             return res.status(404).json({ error: `User with id ${idNum} not found` });
//         }
//
//         const totalAgg = await Cost.aggregate([
//             { $match: { userid: idNum } },
//             { $group: { _id: null, total: { $sum: '$sum' } } }
//         ]);
//
//         const total = totalAgg.length > 0 ? totalAgg[0].total : 0;
//
//         return res.json({
//             first_name: user.first_name,
//             last_name: user.last_name,
//             id: user.id,
//             total
//         });
//     } catch (err) {
//         return res.status(500).json({ error: err.message });
//     }
// });

const { getUserTotalCosts } = require('../services/costServiceClient');

router.get('/:id', async (req, res) => {
    try {
        const idNum = Number(req.params.id);
        if (Number.isNaN(idNum)) {
            return res.status(400).json({ error: 'User id must be a number' });
        }

        const user = await User.findOne({ id: idNum }).lean();
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 👇 HTTP call to Cost service
        const total = await getUserTotalCosts(idNum);

        res.json({
            first_name: user.first_name,
            last_name: user.last_name,
            id: user.id,
            total
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


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
            return res.status(400).json({
                error: 'Missing required fields: id, first_name, last_name, birthday'
            });
        }

        const idNum = Number(id);
        if (Number.isNaN(idNum)) {
            return res.status(400).json({ error: 'id must be a number' });
        }


        const bday = new Date(birthday);
        if (Number.isNaN(bday.getTime())) {
            return res.status(400).json({ error: 'birthday must be a valid date' });
        }


        const user = new User({
            id: idNum,
            first_name,
            last_name,
            birthday: bday
        });

        const exists = await userExistsById(idNum);

        if (exists) {
            return res.status(409).json({
                error: 'User already exists'
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
            return res.status(409).json({ error: 'User with this id already exists' });
        }

        return res.status(400).json({ error: err.message });
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
        res.status(500).json({
            error: err.message
        });
    }
});



const userExistsById = async (userId) => {
    const exists = await User.exists({ id: userId });
    return !!exists;
};

module.exports = router;
