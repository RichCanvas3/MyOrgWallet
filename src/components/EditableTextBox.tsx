import React, { useState } from "react";
import { TextField, IconButton, Box } from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

interface EditableTextBoxProps {
  initialValue?: string;
  onSave?: (value: string) => void;
}

const EditableTextBox: React.FC<EditableTextBoxProps> = ({
  initialValue = "Edit me...",
  onSave,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);

  const handleEdit = () => setIsEditing(true);
  const handleCancel = () => {
    setValue(initialValue); // Reset to initial value
    setIsEditing(false);
  };
  const handleSave = () => {
    onSave?.(value); // Call onSave function if provided
    setIsEditing(false);
  };

  return (
    <Box display="flex" alignItems="center" gap={1}>
      {isEditing ? (
        <>
          <TextField
            value={value}
            onChange={(e) => setValue(e.target.value)}
            size="small"
            variant="outlined"
            autoFocus
          />
          <IconButton color="success" onClick={handleSave}>
            <CheckIcon />
          </IconButton>
          <IconButton color="error" onClick={handleCancel}>
            <CloseIcon />
          </IconButton>
        </>
      ) : (
        <>
          <Box
            sx={{
              border: "1px solid lightgray",
              padding: "8px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              minWidth: "150px",
            }}
            onClick={handleEdit}
          >
            {value}
          </Box>
          <IconButton onClick={handleEdit}>
            <EditIcon />
          </IconButton>
        </>
      )}
    </Box>
  );
};

export default EditableTextBox;
