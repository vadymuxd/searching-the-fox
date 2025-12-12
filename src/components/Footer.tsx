"use client";

import { Box, Container, Stack, Group, Text, UnstyledButton } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import Image from "next/image";
import { useState, useCallback } from "react";
import { IconMail, IconPlayerPlay } from "@tabler/icons-react";
import { VideoPlayerModal } from "./VideoPlayerModal";

export function Footer() {
  const [videoModalOpened, setVideoModalOpened] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleHowItWorks = useCallback(() => {
    setVideoModalOpened(true);
  }, []);

  const handleFeedback = useCallback(() => {
    window.location.href = 'mailto:dhtoque@gmail.com?subject=Search The Fox: Feedback';
  }, []);

  return (
    <Box
      component="footer"
      style={{
        borderTop: '1px solid #DEE2E6',
        backgroundColor: '#f8f9fa',
        padding: '16px 0',
        marginTop: 'auto',
      }}
    >
      <Container size="xl">
        {isDesktop ? (
          // Desktop: all in one horizontal line
          <Group gap={80} justify="center" align="center">
            <Group gap="sm" align="center">
              <Text size="sm" c="dimmed">
                Searching On
              </Text>
              <Group gap="sm" align="center">
                <Image
                  src="/indeed.svg"
                  alt="Indeed"
                  width={24}
                  height={24}
                  style={{ opacity: 0.2 }}
                />
                <Image
                  src="/Linkedin.svg"
                  alt="LinkedIn"
                  width={24}
                  height={24}
                  style={{ opacity: 0.2 }}
                />
              </Group>
            </Group>

            <UnstyledButton
              onClick={handleHowItWorks}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "#888",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              <IconPlayerPlay size={16} />
              <span>How It Works</span>
            </UnstyledButton>

            <UnstyledButton
              onClick={handleFeedback}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "#888",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              <IconMail size={16} />
              <span>Feedback</span>
            </UnstyledButton>
          </Group>
        ) : (
          // Mobile: vertical stack with 80px gap
          <Stack gap={80} align="center">
            <Group gap="sm" align="center" justify="center">
              <Text size="sm" c="dimmed">
                Searching On
              </Text>
              <Group gap="sm" align="center">
                <Image
                  src="/indeed.svg"
                  alt="Indeed"
                  width={24}
                  height={24}
                  style={{ opacity: 0.2 }}
                />
                <Image
                  src="/Linkedin.svg"
                  alt="LinkedIn"
                  width={24}
                  height={24}
                  style={{ opacity: 0.2 }}
                />
              </Group>
            </Group>

            <UnstyledButton
              onClick={handleHowItWorks}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "#888",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              <IconPlayerPlay size={16} />
              <span>How It Works</span>
            </UnstyledButton>

            <UnstyledButton
              onClick={handleFeedback}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                color: "#888",
                fontSize: "0.9rem",
                fontWeight: 500,
              }}
            >
              <IconMail size={16} />
              <span>Feedback</span>
            </UnstyledButton>
          </Stack>
        )}
      </Container>

      <VideoPlayerModal
        opened={videoModalOpened}
        onClose={() => setVideoModalOpened(false)}
        videoUrl="/Search-The-Fox.mp4"
      />
    </Box>
  );
}
