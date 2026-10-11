import { Router } from "express";
import {
  listItems,
  createItem,
  updateItem,
  deleteItem,
} from "../controllers/itemController.js";
import { protect } from "../middleware/authMiddleware.js";
import { loadProject, requireWrite } from "../middleware/projectAccess.js";

// mergeParams lets this router read :projectId from the parent URL
const router = Router({ mergeParams: true });

router.use(protect, loadProject);

router.route("/").get(listItems).post(requireWrite, createItem);
router
  .route("/:itemId")
  .patch(requireWrite, updateItem)
  .delete(requireWrite, deleteItem);

export default router;