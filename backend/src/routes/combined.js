const express = require('express');
const { protect } = require('../middleware/auth');

// Collections
const col = express.Router();
const cc  = require('../controllers/collectionController');
col.use(protect);
col.get('/',    cc.getAll); col.get('/:id', cc.getOne);
col.post('/',   cc.create); col.put('/:id', cc.update); col.delete('/:id', cc.remove);
exports.collections = col;

// Visits
const vis = express.Router();
const vc  = require('../controllers/visitController');
vis.use(protect);
vis.get('/',    vc.getAll); vis.post('/',   vc.create);
vis.put('/:id', vc.update); vis.delete('/:id', vc.remove);
exports.visits = vis;

// Dashboard
const dash = express.Router();
const dc   = require('../controllers/dashboardController');
dash.use(protect);
dash.get('/', dc.getDashboard);
exports.dashboard = dash;

// Reports
const rep = express.Router();
const rc  = require('../controllers/reportController');
rep.use(protect);
rep.get('/sales',              rc.salesReport);
rep.get('/collection',         rc.collectionReport);
rep.get('/visit',              rc.visitReport);
rep.get('/outstanding',        rc.outstandingReport);
rep.get('/target-achievement', rc.targetAchievement);
rep.get('/dealer/:id/stats',   rc.dealerStats);
exports.reports = rep;
