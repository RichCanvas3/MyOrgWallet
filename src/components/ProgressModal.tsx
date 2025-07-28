import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Typography,
  Box,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  IconButton,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Pending,
  PlayArrow,
  Close,
} from '@mui/icons-material';
import { useProgress } from '../context/ProgressContext';

const ProgressModal: React.FC = () => {
  const { progress, hideProgress } = useProgress();

  if (!progress.isVisible) {
    return null;
  }

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      case 'in-progress':
        return <PlayArrow color="primary" />;
      default:
        return <Pending color="disabled" />;
    }
  };

  const getStepColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'error';
      case 'in-progress':
        return 'primary';
      default:
        return 'default';
    }
  };

  return (
    <Dialog
      open={progress.isVisible}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: 400,
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6" component="div">
            {progress.title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {progress.description}
          </Typography>
        </Box>
        <IconButton onClick={hideProgress} size="small">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Overall Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {Math.round(progress.overallProgress)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress.overallProgress}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        <List sx={{ width: '100%' }}>
          {progress.steps.map((step, index) => (
            <ListItem
              key={step.id}
              sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                mb: 1,
                backgroundColor: step.status === 'in-progress' ? 'action.hover' : 'transparent',
              }}
            >
              <ListItemIcon>
                {getStepIcon(step.status)}
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" fontWeight="medium">
                      {step.title}
                    </Typography>
                    <Chip
                      label={step.status}
                      size="small"
                      color={getStepColor(step.status) as any}
                      variant="outlined"
                    />
                  </Box>
                }
                secondary={
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {step.description}
                    </Typography>
                    {step.progress !== undefined && step.status === 'in-progress' && (
                      <Box sx={{ mt: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={step.progress}
                          sx={{ height: 4, borderRadius: 2 }}
                        />
                      </Box>
                    )}
                    {step.error && (
                      <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                        Error: {step.error}
                      </Typography>
                    )}
                  </Box>
                }
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
};

export default ProgressModal; 