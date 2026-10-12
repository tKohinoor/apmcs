import { Router } from "express";
import {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
} from "../controllers/itemController.js";
import {
  listComments,
  createComment,
  deleteComment,
} from "../controllers/commentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { loadProject, requireWrite } from "../middleware/projectAccess.js";

const router = Router({ mergeParams: true });

router.use(protect, loadProject);

router.route("/").get(listItems).post(requireWrite, createItem);
router
  .route("/:itemId")
  .get(getItem)
  .patch(requireWrite, updateItem)
  .delete(requireWrite, deleteItem);

router
  .route("/:itemId/comments")
  .get(listComments)
  .post(requireWrite, createComment);
router.delete("/:itemId/comments/:commentId", requireWrite, deleteComment);

export default router;