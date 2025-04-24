import React from "react";
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Tooltip,
  Divider,
  Avatar,
  Badge,
} from "@mui/material";
import {
  CheckCircle as BadgeCheckIcon,
  Cancel as BadgeXIcon,
  Person as UserIcon,
  AssignmentInd as IdCardIcon,
  Description as FileIcon,
  Bookmark as BookmarkIcon,
  Lock as LockIcon,
  VerifiedUser as ShieldCheckIcon,
  School as AwardIcon,
  EmojiEvents as TrophyIcon,
  InsertDriveFile as FileCheckIcon,
  HourglassEmpty as HourglassIcon,
  CalendarToday as CalendarCheckIcon,
} from "@mui/icons-material";
import { Attestation } from "../models/Attestation";

interface AttestationCardProps {
  attestation: Attestation;
  selected?: boolean;
  onSelect?: () => void;
  hoverable?: boolean;
}

const categoryIcons: Record<string, React.ElementType> = {
  identity: UserIcon,
  document: IdCardIcon,
  biometric: AwardIcon,
  certificate: ShieldCheckIcon,
  social: BookmarkIcon,
  domain: FileCheckIcon,
  registration: FileIcon,
  security: LockIcon,
  compliance: ShieldCheckIcon,
  verification: BadgeCheckIcon,
  default: UserIcon,
};

const badgeDescriptions: Record<string, string> = {
  verified: "Fully confirmed",
  proven: "Strong evidence",
  pending: "Awaiting verification",
};

export function AttestationCard({
  attestation,
  selected = false,
  onSelect,
  hoverable = false,
}: AttestationCardProps) {
  const { entityId, category, isValidated } = attestation;

  // Icon component for category
  const Icon = categoryIcons[category ?? "default"] || categoryIcons.default;

  // Badge state
  let badgeIcon = <BadgeCheckIcon fontSize="small" color="success" />;
  let description = badgeDescriptions.verified;
  let badgeColor: "success" | "info" | "disabled" = "success";

  if (isValidated) {
    badgeIcon = <BadgeCheckIcon fontSize="small" color="info" />;
    description = badgeDescriptions.proven;
    badgeColor = "info";
  }

  return (
    <Card
    variant={selected ? "outlined" : "elevation"}
    sx={{
      width: 160,
      borderColor: selected ? "primary.main" : undefined,
      bgcolor: selected ? "action.selected" : "background.paper",
      boxShadow: selected ? 3 : 1,
      transition: "all 0.2s",
      ...(hoverable && {
        "&:hover": {
          bgcolor: "action.hover",
          borderColor: "primary.main",
          boxShadow: 3,
        },
      }),
    }}
  >
    <CardActionArea onClick={onSelect} sx={{ p: 0 }}>
      <CardContent sx={{ display: "flex", flexDirection: "column", p: 0 }}>
        {/* 1️⃣ First row: icon, entityId, verified badge */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", minWidth: 0 }}>
            <Avatar sx={{ bgcolor: "grey.200", color: "grey.700" }}>
              <Icon />
            </Avatar>
            <Typography
              variant="subtitle2"
              noWrap
              sx={{ ml: 1, fontWeight: 500 }}
            >
              {entityId}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            {badgeIcon}
            
          </Box>
        </Box>

        {/* 2️⃣ Light delimiter */}
        <Divider light />

        {/* 3️⃣ Second row: description */}
        <Box sx={{ p: 1 }}>
          <Typography
            variant="body2"
            color="text.secondary"
            noWrap
            sx={{ lineHeight: 1.2 }}
          >
            {description}
          </Typography>
        </Box>
      </CardContent>
    </CardActionArea>
  </Card>

  );
}

export default AttestationCard;
