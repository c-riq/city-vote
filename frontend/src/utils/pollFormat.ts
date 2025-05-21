export const getDisplayTitle = (pollId: string): string => {
  if (pollId.startsWith('joint_statement_')) {
    if (pollId === 'joint_statement_' || pollId.startsWith('joint_statement__attachment_')) {
      return 'Joint Statement';
    }
    const titleWithoutPrefix = pollId.substring('joint_statement_'.length);
    const attachmentIndex = titleWithoutPrefix.indexOf('_attachment_');
    return attachmentIndex !== -1 
      ? titleWithoutPrefix.substring(0, attachmentIndex) 
      : titleWithoutPrefix;
  } else {
    const attachmentIndex = pollId.indexOf('_attachment_');
    return attachmentIndex !== -1 ? pollId.substring(0, attachmentIndex) : pollId;
  }
};

export const isJointStatement = (pollId: string): boolean => {
  return pollId.startsWith('joint_statement_');
};
