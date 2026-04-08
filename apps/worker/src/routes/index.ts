export { handleAccessRequest, handleLogout, handleRefresh } from './access';
export { handleGetBook, handleGetFileUrl, handleListBooks } from './books';
export { 
  handleGetProgress, 
  handleUpdateProgress, 
  handleListBookmarks, 
  handleCreateBookmark,
  handleDeleteBookmark,
  handleListHighlights,
  handleCreateHighlight 
} from './reader-state';
export { handleListComments, handleCreateComment, handleUpdateComment } from './comments';
export {
  handleCreateBook,
  handleUploadComplete,
  handleCreateAdminGrant,
  handleUpdateGrant,
  handleRevokeGrant,
  handleGetBookGrants,
  handleGetAuditLog,
} from './admin';
