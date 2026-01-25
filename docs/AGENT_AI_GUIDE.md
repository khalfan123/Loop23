# Agent AI Detailed Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Understanding Checkpoints](#understanding-checkpoints)
3. [Checkpoint Components](#checkpoint-components)
4. [Rollback Process](#rollback-process)
5. [Use Cases](#use-cases)
6. [Best Practices](#best-practices)
7. [Database Considerations](#database-considerations)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

---

## Introduction

Replit Agent AI is an autonomous software development assistant that builds and maintains applications for you. The checkpoint and rollback system is a critical feature that ensures you never lose progress and can always return to a working state.

### Key Benefits

- **Complete State Restoration**: Unlike git which only tracks code, checkpoints restore your entire development context
- **Conversation Continuity**: The AI remembers what you discussed and decided
- **Zero-Click Automation**: Checkpoints are created automatically at the right moments
- **Database Integration**: Optionally include your development database in rollbacks

---

## Understanding Checkpoints

### What is a Checkpoint?

A checkpoint is a comprehensive snapshot that captures the complete state of your Replit App at a specific moment in time. Think of it as a "save game" feature for your entire development environment.

### Automatic Checkpoint Creation

The Agent automatically creates checkpoints at strategic moments:

| Trigger | Description |
|---------|-------------|
| **Feature Completion** | After successfully implementing a feature |
| **Mode Transitions** | When switching between Plan and Build modes |
| **Major Milestones** | At significant development breakpoints |
| **Pre-Change Safety** | Before making substantial modifications |

### Checkpoint Frequency

Checkpoints are created frequently enough to provide good recovery points without overwhelming storage. The Agent intelligently determines when a checkpoint would be most valuable.

---

## Checkpoint Components

### 1. Workspace Contents

All files and directories in your project are captured, including:

- Source code files
- Configuration files
- Assets and resources
- Generated files
- Package dependencies list

### 2. AI Conversation Context

The complete chat history is preserved:

- All messages exchanged with the Agent
- Decisions made during development
- Context about requirements and preferences
- Problem-solving discussions

### 3. Environment Configuration

Development environment settings are saved:

- Environment variables
- System configurations
- Workflow settings
- Tool configurations

### 4. Agent Memory

The Agent maintains persistent memory through `replit.md`:

- Project overview and goals
- Recent changes and their dates
- User preferences and coding style
- Architectural decisions
- Known issues and solutions

### 5. Database Contents (Optional)

Development database state can be included:

- All tables and their data
- Schema definitions
- Relationships and constraints

---

## Rollback Process

### Step-by-Step Rollback

1. **Access Checkpoints**
   - Navigate to the checkpoint view in Replit
   - Browse available restoration points

2. **Review Checkpoint Details**
   - See timestamp of each checkpoint
   - Review what changed since that point
   - Identify the best restoration point

3. **Configure Rollback Options**
   - Choose whether to include database
   - Confirm the scope of restoration

4. **Execute Rollback**
   - Single-click to initiate
   - Wait for restoration to complete
   - Verify the restored state

### What Happens During Rollback

When you rollback:

```
1. Current state is safely preserved (can undo the rollback)
2. Selected checkpoint is loaded
3. All components are restored simultaneously
4. AI conversation context is restored
5. Agent memory is restored
6. Optionally, database is restored
```

---

## Use Cases

### 1. Undoing a Breaking Change

**Scenario**: A recent change broke your application.

**Solution**: Rollback to the last checkpoint before the breaking change.

**Steps**:
1. Identify when the app was last working
2. Find the corresponding checkpoint
3. Execute rollback
4. App is restored to working state

### 2. Experimenting with Different Approaches

**Scenario**: You want to try a different implementation approach.

**Solution**: Experiment freely, knowing you can rollback if needed.

**Workflow**:
1. Note your current checkpoint
2. Ask Agent to try the new approach
3. If it works better, continue
4. If not, rollback to the original

### 3. Recovering from Accidental Deletion

**Scenario**: Important files were accidentally deleted.

**Solution**: Rollback to before the deletion occurred.

**Benefits**:
- No need to remember what was deleted
- Complete restoration of all files
- Context and conversation preserved

### 4. Fixing Database Issues

**Scenario**: Development database has corrupted or bad data.

**Solution**: Rollback with database option enabled.

**Important**: This only affects development database. Production database requires separate point-in-time restore.

### 5. Starting Fresh on a Feature

**Scenario**: A feature implementation went wrong from the start.

**Solution**: Rollback to before the feature was started.

**Advantage**: Completely fresh start with all context preserved about what didn't work.

---

## Best Practices

### DO:

- **Trust the automatic checkpoints**: They're created at optimal moments
- **Review before major changes**: Know where you can rollback to
- **Include database when relevant**: If data matters, include it
- **Document in conversation**: The AI remembers what you discuss
- **Use rollback for experiments**: Don't be afraid to try things

### DON'T:

- **Panic when things break**: Rollback is always available
- **Manually try to recreate states**: Use rollback instead
- **Ignore the checkpoint system**: It's there to help you
- **Forget about database option**: Consider if data needs restoration

---

## Database Considerations

### Development Database

| Action | Behavior |
|--------|----------|
| **Rollback with DB** | Database restored to checkpoint state |
| **Rollback without DB** | Database remains unchanged |

### Production Database

The production database is **separate** from the checkpoint system.

To restore production data:
- Use the **point-in-time restore** feature
- This is a separate process from checkpoint rollback
- Provides more granular control for production data

### When to Include Database in Rollback

Include database when:
- Data was accidentally deleted or corrupted
- Schema changes broke the application
- Test data needs to be restored
- Starting fresh with clean data

Exclude database when:
- Only code changes need to be reverted
- Database data is valuable and shouldn't change
- You've added important data since the checkpoint

---

## Troubleshooting

### Common Issues

#### Rollback Seems Slow

**Cause**: Large workspace or database being restored.

**Solution**: Wait for completion. Larger projects take more time.

#### Database Not Restored

**Cause**: Database option was not selected during rollback.

**Solution**: Rollback again with database option enabled.

#### Unexpected State After Rollback

**Cause**: Rolled back to wrong checkpoint.

**Solution**: 
1. You can undo the rollback
2. Select the correct checkpoint
3. Rollback again

#### Missing Recent Changes

**Cause**: Changes were made after the checkpoint you restored.

**Solution**: 
1. Check if a more recent checkpoint exists
2. If not, the changes may need to be recreated

---

## FAQ

### Q: How often are checkpoints created?

A: Automatically at key milestones - feature completions, mode transitions, and before major changes. You don't need to create them manually.

### Q: Can I create manual checkpoints?

A: The system is designed for automatic checkpoint creation at optimal moments. Trust the Agent to create checkpoints when needed.

### Q: Does rollback affect my production app?

A: Rollback affects your development environment. Production deployments are separate and must be managed through the publishing system.

### Q: Can I undo a rollback?

A: Yes, your state before rollback is preserved, allowing you to undo if needed.

### Q: What if I need to restore just one file?

A: Rollback restores the complete state. For single-file recovery, you might consider using git history or performing a full rollback.

### Q: Is my conversation history preserved in rollback?

A: Yes, the AI conversation context is fully restored to match the checkpoint state.

### Q: How long are checkpoints kept?

A: Checkpoints are maintained as long as they're useful for your development. Older checkpoints may be consolidated over time.

### Q: Can I share checkpoints with teammates?

A: Checkpoints are associated with your Replit App and are available to collaborators with appropriate access.

---

## Summary

The Agent AI checkpoint and rollback system provides:

- Automatic state snapshots at key moments
- Complete restoration including code, conversation, and optionally database
- Simple one-click rollback process
- Freedom to experiment knowing you can always go back

Use this feature confidently to accelerate your development while maintaining safety nets for recovery.
