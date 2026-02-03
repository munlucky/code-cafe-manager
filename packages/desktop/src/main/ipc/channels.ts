/**
 * IPC Channel Names
 * Centralized channel name management to avoid typos and enable autocomplete
 */

export const IPC_CHANNELS = {
  ORDER: {
    CREATE_WITH_WORKTREE: 'order:createWithWorktree',
    CREATE: 'order:create',
    GET: 'order:get',
    GET_ALL: 'order:getAll',
    CANCEL: 'order:cancel',
    DELETE: 'order:delete',
    DELETE_MANY: 'order:deleteMany',
    EXECUTE: 'order:execute',
    SEND_INPUT: 'order:sendInput',
    GET_LOG: 'order:getLog',
    SUBSCRIBE_OUTPUT: 'order:subscribeOutput',
    UNSUBSCRIBE_OUTPUT: 'order:unsubscribeOutput',
    RETRY_WORKTREE: 'order:retryWorktree',
    RETRY_FROM_STAGE: 'order:retryFromStage',
    GET_RETRY_OPTIONS: 'order:getRetryOptions',
    RETRY_FROM_BEGINNING: 'order:retryFromBeginning',
    ENTER_FOLLOWUP: 'order:enterFollowup',
    EXECUTE_FOLLOWUP: 'order:executeFollowup',
    FINISH_FOLLOWUP: 'order:finishFollowup',
    CAN_FOLLOWUP: 'order:canFollowup',
    CLEANUP_WORKTREE_ONLY: 'order:cleanupWorktreeOnly',
    MERGE_WORKTREE_TO_MAIN: 'order:mergeWorktreeToMain',
  },
  RECEIPT: {
    GET_ALL: 'receipt:getAll',
  },
  WORKFLOW: {
    LIST: 'workflow:list',
    GET: 'workflow:get',
    CREATE: 'workflow:create',
    UPDATE: 'workflow:update',
    DELETE: 'workflow:delete',
    RUN: 'workflow:run',
  },
  RUN: {
    LIST: 'run:list',
    GET_STATUS: 'run:getStatus',
    GET_DETAIL: 'run:getDetail',
    PAUSE: 'run:pause',
    RESUME: 'run:resume',
    CANCEL: 'run:cancel',
    GET_LOGS: 'run:getLogs',
    SUBSCRIBE: 'run:subscribe',
  },
} as const;
